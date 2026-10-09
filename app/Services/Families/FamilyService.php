<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyCashout;
use App\Models\FamilyMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FamilyService
{
    public function __construct(
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
        private readonly FamilyChat $chat,
        private readonly Warehouse $warehouse,
        private readonly FamilyGate $gate,
    ) {}

    /**
     * @param  array{server_id: int, name: string, tag: string, description?: string|null, rp_nickname: string, static_id: string}  $data
     */
    public function create(User $owner, array $data): Family
    {
        $this->ensureFreeOnServer($owner, (int) $data['server_id']);
        $this->ensureStaticFree((int) $data['server_id'], $data['static_id'], $owner);

        $family = DB::transaction(function () use ($owner, $data) {
            $family = Family::query()->create([
                'server_id' => $data['server_id'],
                'owner_id' => $owner->id,
                'slug' => $this->uniqueSlug($data['name']),
                'name' => $data['name'],
                'tag' => Str::upper($data['tag']),
                'description' => $data['description'] ?? null,
                'status' => Family::STATUS_PENDING,
                'rank_titles' => Family::DEFAULT_RANKS,
                'permissions' => Family::DEFAULT_PERMISSIONS,
            ]);

            $leader = $family->members()->create([
                'user_id' => $owner->id,
                'rp_nickname' => $data['rp_nickname'],
                'static_id' => $data['static_id'],
                'rank' => Family::LEADER_RANK,
                'status' => FamilyMember::STATUS_ACTIVE,
                'joined_at' => now(),
            ]);

            $this->warehouse->seedStarter($family);
            $this->recount($family);
            $this->audit->log($family, 'FAMILY_CREATE', $leader, null, ['name' => $family->name, 'tag' => $family->tag, 'server_id' => $family->server_id]);

            return $family;
        });

        $this->gate->forget();

        return $family;
    }

    /**
     * @param  array{rp_nickname: string, static_id: string, note?: string|null}  $data
     */
    public function apply(Family $family, User $user, array $data, bool $invited = false): FamilyMember
    {
        if (! $family->isVerified()) {
            throw ValidationException::withMessages(['family' => 'Сім’я ще не пройшла верифікацію — заявки поки не приймаються.']);
        }
        if (! $family->is_recruiting && ! $invited) {
            throw ValidationException::withMessages(['family' => 'Набір у сім’ю закрито.']);
        }
        $this->ensureFreeOnServer($user, (int) $family->server_id, $family);
        $this->ensureStaticFree((int) $family->server_id, $data['static_id'], $user);

        $existing = FamilyMember::query()->where('family_id', $family->id)->where('user_id', $user->id)->first();
        if ($existing?->status === FamilyMember::STATUS_PENDING) {
            throw ValidationException::withMessages(['family' => 'Заявку вже подано, очікуйте розгляду.']);
        }
        if ($existing?->status === FamilyMember::STATUS_KICKED && $existing->left_at?->gt(now()->subDays(7))) {
            throw ValidationException::withMessages(['family' => 'Після виключення подати заявку можна через 7 днів.']);
        }

        $this->ensureIdentityFree($family, $data['rp_nickname'], $data['static_id'], $existing);

        $member = DB::transaction(function () use ($family, $user, $data, $existing) {
            $member = $existing ?? new FamilyMember(['family_id' => $family->id, 'user_id' => $user->id]);
            $member->fill([
                'rp_nickname' => $data['rp_nickname'],
                'static_id' => $data['static_id'],
                'application_note' => $data['note'] ?? null,
                'status' => FamilyMember::STATUS_PENDING,
                'rank' => 1,
                'duties' => null,
                'left_at' => null,
            ])->save();

            $this->audit->log($family, 'MEMBER_APPLY', null, $member, ['nickname' => $member->rp_nickname, 'static_id' => $member->static_id], $user);

            return $member;
        });

        $this->notifier->holders($family, 'members.manage', 'application', "Нова заявка: {$member->displayName()}", route('families.members', [$family, 'tab' => 'applications'], absolute: false));
        $this->notifier->refresh($family, 'members');

        return $member;
    }

    public function accept(Family $family, FamilyMember $actor, FamilyMember $applicant): void
    {
        if ($applicant->status !== FamilyMember::STATUS_PENDING) {
            throw ValidationException::withMessages(['member' => 'Заявку вже розглянуто.']);
        }
        $applicant->loadMissing('user');
        $this->ensureFreeOnServer($applicant->user, (int) $family->server_id, $family);

        DB::transaction(function () use ($family, $actor, $applicant) {
            $applicant->update(['status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now(), 'left_at' => null]);
            $this->recount($family);
            $this->audit->log($family, 'MEMBER_ACCEPT', $actor, $applicant, ['nickname' => $applicant->rp_nickname, 'static_id' => $applicant->static_id]);
        });

        $this->chat->memberJoined($family, $applicant);
        $this->notifier->members($applicant, $family, 'accepted', "Вас прийнято до сім’ї [{$family->tag}] {$family->name}! 🎉", route('families.show', $family, absolute: false));
        $this->notifier->refresh($family, 'members');
    }

    public function decline(Family $family, FamilyMember $actor, FamilyMember $applicant, ?string $reason): void
    {
        if ($applicant->status !== FamilyMember::STATUS_PENDING) {
            throw ValidationException::withMessages(['member' => 'Заявку вже розглянуто.']);
        }

        $applicant->update(['status' => FamilyMember::STATUS_DECLINED, 'left_at' => now()]);
        $this->audit->log($family, 'MEMBER_DECLINE', $actor, $applicant, ['reason' => $reason]);
        $this->notifier->members($applicant, $family, 'declined', "Заявку до [{$family->tag}] {$family->name} відхилено".($reason ? ": {$reason}" : ''), route('families.show', $family, absolute: false));
        $this->notifier->refresh($family, 'members');
    }

    public function leave(Family $family, FamilyMember $member): void
    {
        if ($member->user_id === $family->owner_id) {
            throw ValidationException::withMessages(['family' => 'Спершу передайте лідерство іншому учаснику.']);
        }

        DB::transaction(function () use ($family, $member) {
            $member->update(['status' => FamilyMember::STATUS_LEFT, 'left_at' => now(), 'duties' => null]);
            $this->recount($family);
            $this->audit->log($family, 'MEMBER_LEAVE', $member, $member);
        });

        $this->gate->forget();
        $this->chat->sync($family);
        $this->chat->announce($family, "{$member->displayName()} покинув(-ла) сім’ю.");
        $this->notifier->refresh($family, 'members');
    }

    public function kick(Family $family, ?FamilyMember $actor, FamilyMember $target, string $reason, bool $logged = false): void
    {
        if ($target->user_id === $family->owner_id) {
            throw ValidationException::withMessages(['member_id' => 'Лідера-власника виключити не можна.']);
        }
        if ($actor && ! $actor->outranks($target, $family)) {
            throw ValidationException::withMessages(['member_id' => 'Виключати можна лише учасників із нижчим рангом.']);
        }

        DB::transaction(function () use ($family, $actor, $target, $reason, $logged) {
            $target->update(['status' => FamilyMember::STATUS_KICKED, 'left_at' => now(), 'duties' => null]);
            $this->recount($family);
            if (! $logged) {
                $this->audit->log($family, 'MEMBER_KICK', $actor, $target, ['reason' => $reason]);
            }
        });

        $this->gate->forget();
        $this->chat->sync($family);
        $this->chat->announce($family, "{$target->displayName()} виключено із сім’ї. Причина: {$reason}");
        $this->notifier->members($target, $family, 'kicked', "Вас виключено з [{$family->tag}] {$family->name}: {$reason}", route('families.index', absolute: false));
        $this->notifier->refresh($family, 'members');

        $pending = FamilyCashout::query()->where('member_id', $target->id)->where('status', FamilyCashout::STATUS_PENDING)->count();
        if ($pending > 0) {
            $this->notifier->holders($family, 'treasury.manage', 'cashout', "У виключеного {$target->displayName()} лишилось заявок на виведення: {$pending}", route('families.queue', [$family, 'tab' => 'cashouts'], absolute: false));
        }
    }

    public function setRank(Family $family, FamilyMember $actor, FamilyMember $target, int $rank): void
    {
        $isOwner = $actor->user_id === $family->owner_id;
        if (! $actor->outranks($target, $family) || (! $isOwner && $rank >= $actor->rank)) {
            throw ValidationException::withMessages(['rank' => 'Можна призначати лише ранг, нижчий за ваш, і лише молодшим учасникам.']);
        }
        if ($rank >= Family::LEADER_RANK) {
            throw ValidationException::withMessages(['rank' => 'Ранг лідера передається через «Передати лідерство».']);
        }

        $before = $target->rank;
        if ($before === $rank) {
            return;
        }

        $target->update(['rank' => $rank, 'duties' => $rank === Family::DEPUTY_RANK ? $target->duties : null]);
        $this->audit->log($family, 'RANK_UPDATE', $actor, $target, [
            'from' => $before,
            'to' => $rank,
            'from_title' => $family->rankTitle($before),
            'to_title' => $family->rankTitle($rank),
        ]);
        $this->chat->sync($family);
        $verb = $rank > $before ? 'підвищено' : 'понижено';
        $this->notifier->members($target, $family, 'rank', "Вас {$verb} до рангу «{$family->rankTitle($rank)}»", route('families.show', $family, absolute: false));
        $this->notifier->refresh($family, 'members');
    }

    public function setDuties(Family $family, FamilyMember $actor, FamilyMember $target, ?string $duties): void
    {
        if ($target->rank !== Family::DEPUTY_RANK) {
            throw ValidationException::withMessages(['duties' => 'Обов’язки призначаються заступникам (ранг 9).']);
        }
        if (! $actor->outranks($target, $family) && $actor->id !== $target->id) {
            throw ValidationException::withMessages(['duties' => 'Недостатньо прав.']);
        }

        $before = $target->duties;
        $target->update(['duties' => $duties]);
        $this->audit->log($family, 'DUTIES_UPDATE', $actor, $target, ['from' => $before, 'to' => $duties]);
    }

    public function updateIdentity(Family $family, FamilyMember $actor, FamilyMember $target, string $nickname, string $staticId): void
    {
        $this->ensureIdentityFree($family, $nickname, $staticId, $target);
        $this->ensureStaticFree((int) $family->server_id, $staticId, $target->user()->firstOrFail());

        $before = ['nickname' => $target->rp_nickname, 'static_id' => $target->static_id];
        $target->update(['rp_nickname' => $nickname, 'static_id' => $staticId]);
        $this->audit->log($family, 'MEMBER_UPDATE', $actor, $target, ['from' => $before, 'to' => ['nickname' => $nickname, 'static_id' => $staticId]]);
    }

    public function transfer(Family $family, FamilyMember $owner, FamilyMember $target): void
    {
        if ($owner->user_id !== $family->owner_id || ! $target->isActive() || $target->id === $owner->id) {
            throw ValidationException::withMessages(['member_id' => 'Лідерство можна передати лише активному учаснику.']);
        }

        DB::transaction(function () use ($family, $owner, $target) {
            $owner->update(['rank' => Family::DEPUTY_RANK]);
            $target->update(['rank' => Family::LEADER_RANK, 'duties' => null]);
            $family->update(['owner_id' => $target->user_id]);
            $this->audit->log($family, 'RANK_UPDATE', $owner, $target, ['transfer' => true, 'from' => $owner->displayName(), 'to' => $target->displayName()]);
        });

        $this->gate->forget();
        $this->chat->ensure($family);
        $this->chat->announce($family, "👑 Лідерство передано: {$target->displayName()}.");
    }

    /**
     * Рішення платформи (суперадмін) щодо статусу сім’ї.
     */
    public function setStatus(Family $family, User $admin, string $status, ?string $reason): void
    {
        $before = $family->status;
        $family->update([
            'status' => $status,
            'status_reason' => $reason,
            'verified_at' => $status === Family::STATUS_VERIFIED ? ($family->verified_at ?? now()) : $family->verified_at,
        ]);
        $this->audit->log($family, 'FAMILY_STATUS', null, null, ['from' => $before, 'to' => $status, 'reason' => $reason], $admin);

        if ($status === Family::STATUS_VERIFIED) {
            $this->chat->ensure($family);
        }

        $text = match ($status) {
            Family::STATUS_VERIFIED => "Сім’ю [{$family->tag}] {$family->name} верифіковано ✅ Чат сім’ї вже доступний.",
            Family::STATUS_SUSPENDED => "Сім’ю [{$family->tag}] {$family->name} призупинено".($reason ? ": {$reason}" : '.'),
            default => "Сім’ю [{$family->tag}] {$family->name} повернуто на верифікацію".($reason ? ": {$reason}" : '.'),
        };
        $leaders = $family->activeMembers()->with('user')->where('rank', '>=', Family::DEPUTY_RANK)->get();
        $this->notifier->members($leaders, $family, 'status', $text, route('families.show', $family, absolute: false));
    }

    public function recount(Family $family): void
    {
        $family->forceFill(['members_count' => $family->activeMembers()->count()])->saveQuietly();
    }

    public function uniqueSlug(string $name): string
    {
        $base = Str::limit(Str::slug(Str::transliterate($name)) ?: 'family', 50, '');
        $slug = $base;
        $i = 2;
        while (Family::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /**
     * Один гравець — одна активна сім’я на сервері.
     */
    private function ensureFreeOnServer(User $user, int $serverId, ?Family $except = null): void
    {
        $busy = FamilyMember::query()
            ->where('user_id', $user->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->whereHas('family', fn ($q) => $q->where('server_id', $serverId)->when($except, fn ($q, Family $f) => $q->whereKeyNot($f->id)))
            ->with('family')
            ->first();

        if ($busy) {
            throw ValidationException::withMessages(['server_id' => "Ви вже в сім’ї [{$busy->family->tag}] {$busy->family->name} на цьому сервері."]);
        }
    }

    /**
     * Static ID на сервері належить одному гравцю.
     */
    private function ensureStaticFree(int $serverId, string $staticId, User $user): void
    {
        $taken = FamilyMember::query()
            ->where('static_id', $staticId)
            ->where('user_id', '!=', $user->id)
            ->whereIn('status', [FamilyMember::STATUS_ACTIVE, FamilyMember::STATUS_PENDING])
            ->whereHas('family', fn ($q) => $q->where('server_id', $serverId))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages(['static_id' => 'Цей Static ID на сервері вже закріплений за іншим гравцем.']);
        }
    }

    private function ensureIdentityFree(Family $family, string $nickname, string $staticId, ?FamilyMember $except): void
    {
        $clash = FamilyMember::query()
            ->where('family_id', $family->id)
            ->when($except, fn ($q, FamilyMember $m) => $q->whereKeyNot($m->id))
            ->where(fn ($q) => $q->where('rp_nickname', $nickname)->orWhere('static_id', $staticId))
            ->first();

        if ($clash) {
            throw ValidationException::withMessages($clash->static_id === $staticId
                ? ['static_id' => 'Цей Static ID уже є в сім’ї.']
                : ['rp_nickname' => 'Цей нікнейм уже є в сім’ї.']);
        }
    }
}
