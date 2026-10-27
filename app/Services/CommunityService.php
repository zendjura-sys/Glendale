<?php

namespace App\Services;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\User;
use App\Notifications\CommunityActivity;
use App\Services\Communities\CommunityChannels;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CommunityService
{
    public const MAX_OWNED = 20;

    /** Слаги, що конфліктують з маршрутами або вводять в оману. */
    public const RESERVED_SLUGS = ['admin', 'create', 'new', 'settings', 'members', 'api', 'gamecon', 'support', 'help'];

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $owner, array $data): Community
    {
        if (Community::query()->where('owner_id', $owner->id)->count() >= self::MAX_OWNED) {
            throw ValidationException::withMessages(['name' => 'Можна створити не більше '.self::MAX_OWNED.' спільнот.']);
        }

        return DB::transaction(function () use ($owner, $data) {
            $community = Community::query()->create([
                ...$data,
                'slug' => $data['slug'] ?? $this->uniqueSlug($data['name']),
                'owner_id' => $owner->id,
            ]);

            $community->memberships()->create([
                'user_id' => $owner->id,
                'role' => CommunityMember::ROLE_OWNER,
                'status' => CommunityMember::STATUS_ACTIVE,
            ]);

            $this->recount($community);

            return $community;
        });
    }

    public function uniqueSlug(string $name): string
    {
        $base = Str::of(Str::transliterate($name))->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_')->limit(24, '')->value();
        $base = preg_match('/^[a-z]/', $base) ? $base : 'club_'.$base;
        $base = rtrim($base, '_') ?: 'club';

        $slug = $base;
        $i = 1;
        while (in_array($slug, self::RESERVED_SLUGS, true) || Community::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.(++$i);
        }

        return $slug;
    }

    /**
     * Вступ або заявка. Повертає статус участі.
     */
    public function join(Community $community, User $user, bool $invited = false, ?string $password = null): string
    {
        $existing = $community->membershipFor($user);
        // Спільнота з паролем: правильний пароль одразу робить учасником (без заявки), запрошення — без пароля.
        $byPassword = false;
        if (! $existing && ! $invited && $community->join_password !== null && ! $user->isStaff()) {
            $this->checkPassword($community, $user, $password);
            $byPassword = true;
        }

        if ($existing) {
            if ($invited && $existing->status === CommunityMember::STATUS_PENDING) {
                $existing->update(['status' => CommunityMember::STATUS_ACTIVE]);
                $this->recount($community);
                app(CommunityWall::class)->welcome($community, $user);
            }

            return $existing->fresh()->status;
        }

        $status = $invited || $byPassword || ! $community->isClosed() ? CommunityMember::STATUS_ACTIVE : CommunityMember::STATUS_PENDING;

        $community->memberships()->create([
            'user_id' => $user->id,
            'role' => CommunityMember::ROLE_MEMBER,
            'status' => $status,
        ]);

        if ($status === CommunityMember::STATUS_PENDING) {
            Notification::send($this->admins($community), new CommunityActivity(CommunityActivity::REQUEST, $user, $community));
        } else {
            app(CommunityWall::class)->welcome($community, $user);
        }

        $this->recount($community);

        return $status;
    }

    /** Пароль для вступу: 5 помилок за 10 хвилин — пауза, щоб не перебирали. */
    private function checkPassword(Community $community, User $user, ?string $password): void
    {
        $key = 'community-password:'.$community->id.':'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages(['password' => 'Забагато спроб. Спробуйте за '.ceil(RateLimiter::availableIn($key) / 60).' хв.']);
        }
        if ($password === null || $password === '') {
            throw ValidationException::withMessages(['password' => 'Щоб вступити, введіть пароль спільноти.']);
        }
        if (! Hash::check($password, (string) $community->join_password)) {
            RateLimiter::hit($key, 600);
            throw ValidationException::withMessages(['password' => 'Неправильний пароль.']);
        }
        RateLimiter::clear($key);
    }

    /** Новий акаунт: вступ у спільноти, які адмін сайту позначив «для всіх новачків». */
    public function autoJoin(User $user): void
    {
        Community::query()->where('auto_join', true)->get()
            ->each(fn (Community $community) => $this->join($community, $user, invited: true));
    }

    public function leave(Community $community, User $user): void
    {
        $membership = $community->membershipFor($user);

        if (! $membership) {
            return;
        }

        if ($membership->role === CommunityMember::ROLE_OWNER) {
            throw ValidationException::withMessages(['membership' => 'Власник не може покинути спільноту. Спершу передайте права іншому адміністратору.']);
        }

        $membership->delete();
        app(CommunityChannels::class)->forget($community, $user);
        $this->recount($community);
    }

    public function approve(Community $community, User $user): void
    {
        $updated = $community->memberships()
            ->where('user_id', $user->id)
            ->where('status', CommunityMember::STATUS_PENDING)
            ->update(['status' => CommunityMember::STATUS_ACTIVE]);

        if ($updated) {
            $user->notify(new CommunityActivity(CommunityActivity::APPROVED, null, $community));
            $this->recount($community);
            app(CommunityWall::class)->welcome($community, $user);
        }
    }

    public function remove(Community $community, User $actor, User $target): void
    {
        $actorRow = $community->membershipFor($actor);
        $targetRow = $community->membershipFor($target);

        abort_if($targetRow === null, 404);
        abort_unless($actorRow?->isAdmin() || $actor->isStaff(), 403);
        abort_if($targetRow->role === CommunityMember::ROLE_OWNER, 403, 'Власника не можна виключити.');
        abort_if(
            $targetRow->role === CommunityMember::ROLE_ADMIN && $actorRow?->role !== CommunityMember::ROLE_OWNER && ! $actor->isStaff(),
            403,
            'Адміністратора може виключити лише власник.',
        );

        $targetRow->delete();
        app(CommunityChannels::class)->forget($community, $target);
        $this->recount($community);
    }

    /**
     * Призначення ролі. Власника передає лише власник — сам стає адміністратором.
     */
    public function setRole(Community $community, User $actor, User $target, string $role): void
    {
        $actorRow = $community->membershipFor($actor);
        $targetRow = $community->membershipFor($target);

        abort_if($targetRow === null || ! $targetRow->isActive(), 404);
        abort_unless($actorRow?->isAdmin(), 403);
        abort_if($actor->is($target), 422, 'Не можна змінити власну роль.');

        $isOwner = $actorRow->role === CommunityMember::ROLE_OWNER;
        abort_if($targetRow->role === CommunityMember::ROLE_OWNER, 403);
        abort_if(in_array($role, [CommunityMember::ROLE_OWNER, CommunityMember::ROLE_ADMIN], true) && ! $isOwner, 403, 'Призначати адміністраторів може лише власник.');
        abort_if($targetRow->role === CommunityMember::ROLE_ADMIN && ! $isOwner, 403);

        DB::transaction(function () use ($community, $actorRow, $targetRow, $role) {
            if ($role === CommunityMember::ROLE_OWNER) {
                $actorRow->update(['role' => CommunityMember::ROLE_ADMIN]);
                $community->update(['owner_id' => $targetRow->user_id]);
            }

            $targetRow->update(['role' => $role]);
        });
    }

    public function canView(Community $community, ?User $user, ?CommunityMember $membership = null): bool
    {
        return ! $community->isClosed()
            || ($membership ?? $community->membershipFor($user))?->isActive()
            || (bool) $user?->isStaff();
    }

    public function canPost(Community $community, ?CommunityMember $membership): bool
    {
        if (! $membership?->isActive()) {
            return false;
        }

        return $membership->isManager()
            || (! $community->isPublic() && $community->wall === Community::WALL_OPEN);
    }

    /**
     * @return list<int>
     */
    public function joinedIds(User $user): array
    {
        return $this->intList(CommunityMember::query()
            ->where('user_id', $user->id)
            ->where('status', CommunityMember::STATUS_ACTIVE)
            ->pluck('community_id'));
    }

    /**
     * Спільноти, де користувач — редактор і вище.
     *
     * @return list<int>
     */
    public function managedIds(User $user): array
    {
        return $this->intList(CommunityMember::query()
            ->where('user_id', $user->id)
            ->where('status', CommunityMember::STATUS_ACTIVE)
            ->whereIn('role', CommunityMember::MANAGER_ROLES)
            ->pluck('community_id'));
    }

    /**
     * @param  iterable<mixed>  $ids
     * @return list<int>
     */
    private function intList(iterable $ids): array
    {
        $list = [];
        foreach ($ids as $id) {
            if (is_numeric($id)) {
                $list[] = (int) $id;
            }
        }

        return $list;
    }

    public function recount(Community $community): void
    {
        $community->forceFill(['members_count' => $community->activeMembers()->count()])->saveQuietly();
    }

    /**
     * @return Collection<int, User>
     */
    private function admins(Community $community)
    {
        return User::query()
            ->whereIn('id', $community->activeMembers()->whereIn('role', [CommunityMember::ROLE_OWNER, CommunityMember::ROLE_ADMIN])->select('user_id'))
            ->get();
    }
}
