<?php

namespace App\Services;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\User;
use App\Notifications\CommunityActivity;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
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
    public function join(Community $community, User $user): string
    {
        $existing = $community->membershipFor($user);

        if ($existing) {
            return $existing->status;
        }

        $status = $community->isClosed() ? CommunityMember::STATUS_PENDING : CommunityMember::STATUS_ACTIVE;

        $community->memberships()->create([
            'user_id' => $user->id,
            'role' => CommunityMember::ROLE_MEMBER,
            'status' => $status,
        ]);

        if ($status === CommunityMember::STATUS_PENDING) {
            Notification::send($this->admins($community), new CommunityActivity(CommunityActivity::REQUEST, $user, $community));
        }

        $this->recount($community);

        return $status;
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
        return CommunityMember::query()
            ->where('user_id', $user->id)
            ->where('status', CommunityMember::STATUS_ACTIVE)
            ->pluck('community_id')
            ->all();
    }

    /**
     * Спільноти, де користувач — редактор і вище.
     *
     * @return list<int>
     */
    public function managedIds(User $user): array
    {
        return CommunityMember::query()
            ->where('user_id', $user->id)
            ->where('status', CommunityMember::STATUS_ACTIVE)
            ->whereIn('role', CommunityMember::MANAGER_ROLES)
            ->pluck('community_id')
            ->all();
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
