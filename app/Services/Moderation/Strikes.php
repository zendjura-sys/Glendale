<?php

namespace App\Services\Moderation;

use App\Models\User;
use App\Models\UserStrike;
use App\Notifications\AccountNotice;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Страйки: кожне підтверджене порушення — попередження на 90 днів.
 * 3 активні — заборона писати на добу, 5 — на тиждень. Людина бачить свої страйки
 * в налаштуваннях і може оскаржити (прийняте оскарження знімає останній).
 */
class Strikes
{
    public const DAYS = 90;

    /** Скільки активних страйків → на скільки годин заборона писати. */
    public const THRESHOLDS = [5 => 168, 3 => 24];

    public function add(User $target, ?User $moderator, ?string $reason, string $source = 'manual'): ?UserStrike
    {
        if ($target->isStaff() || ! app(Plugins::class)->on('strikes')) {
            return null;
        }
        $strike = UserStrike::query()->create([
            'user_id' => $target->id,
            'moderator_id' => $moderator?->id,
            'reason' => Str::limit(trim((string) $reason) !== '' ? trim((string) $reason) : 'Порушення правил спільноти', 200, ''),
            'source' => $source,
            'expires_at' => now()->addDays(self::DAYS),
        ]);
        $active = $this->activeCount($target);
        Log::info('moderation: strike', ['user' => $target->id, 'by' => $moderator?->id, 'source' => $source, 'active' => $active]);

        $hours = null;
        foreach (self::THRESHOLDS as $count => $muteHours) {
            if ($active >= $count) {
                $hours = $muteHours;
                break;
            }
        }
        if ($hours !== null && ($target->muted_until === null || $target->muted_until->lt(now()->addHours($hours)))) {
            $target->forceFill(['muted_until' => now()->addHours($hours), 'mute_reason' => "Активних страйків: {$active}"])->save();
        }

        $target->notify(new AccountNotice('strike', null, 'Ви отримали страйк ('.$active.' з 5)', $strike->reason.($hours ? ' Писати не можна '.($hours >= 168 ? 'тиждень' : 'добу').'.' : ''), '/settings/account'));

        return $strike;
    }

    public function activeCount(User $user): int
    {
        return UserStrike::query()->where('user_id', $user->id)->whereNull('revoked_at')->where('expires_at', '>', now())->count();
    }

    /**
     * @return list<array{id: int, reason: string, active: bool, expires_at: string, created_at: string}>
     */
    public function history(User $user): array
    {
        return array_values(UserStrike::query()->where('user_id', $user->id)->latest('id')->limit(20)->get()
            ->map(fn (UserStrike $s) => ['id' => $s->id, 'reason' => $s->reason, 'active' => $s->isActive(), 'expires_at' => $s->expires_at->toIso8601String(), 'created_at' => $s->created_at->toIso8601String()])->all());
    }

    public function revoke(UserStrike $strike, User $moderator): void
    {
        $strike->update(['revoked_at' => now()]);
        Log::info('admin: strike revoked', ['strike' => $strike->id, 'user' => $strike->user_id, 'by' => $moderator->id]);
    }

    /** Прийняте оскарження страйку — знімаємо останній активний. */
    public function revokeLatest(User $user, User $moderator): void
    {
        $strike = UserStrike::query()->where('user_id', $user->id)->whereNull('revoked_at')->where('expires_at', '>', now())->latest('id')->first();
        if ($strike !== null) {
            $this->revoke($strike, $moderator);
        }
    }
}
