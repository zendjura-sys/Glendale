<?php

namespace App\Services\Plus;

use App\Models\Family;
use App\Models\PlusCode;
use App\Models\PlusGrant;
use App\Models\PlusSubscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * GameCon+: періоди доступу (plus_grants) і кешований статус plus_until у власника.
 *
 * Подарунки, промокоди й видача адміністратором складаються в чергу одне за одним;
 * підписка — окремий період, який рухається разом із датою продовження.
 */
class Plus
{
    public function active(User|Family|null $owner): bool
    {
        return $owner !== null && $owner->isPlus();
    }

    /**
     * Ліміт для людини: [без GameCon+, з GameCon+]; null — загальне налаштування сайту.
     */
    public function limit(?User $user, string $key): ?int
    {
        $pair = (array) config("plus.limits.{$key}");
        $value = $pair[$this->active($user) ? 1 : 0] ?? null;

        return $value === null ? null : (int) $value;
    }

    public function familyLimit(Family $family, string $key): ?int
    {
        $pair = (array) config("plus.limits.{$key}");
        $value = $pair[$family->isPlus() ? 1 : 0] ?? null;

        return $value === null ? null : (int) $value;
    }

    /**
     * Додає дні після останнього разового періоду (або від сьогодні).
     */
    public function grant(User|Family $owner, int $days, string $source, ?User $by = null, ?string $note = null, ?int $paymentId = null): PlusGrant
    {
        return DB::transaction(function () use ($owner, $days, $source, $by, $note, $paymentId) {
            $last = PlusGrant::query()
                ->where('owner_type', $this->type($owner))->where('owner_id', $owner->id)
                ->where('source', '!=', 'subscription')
                ->max('ends_at');
            $start = $last !== null && now()->lt($last) ? now()->parse($last) : now();

            $grant = PlusGrant::query()->create([
                'owner_type' => $this->type($owner),
                'owner_id' => $owner->id,
                'source' => $source,
                'payment_id' => $paymentId,
                'by_user_id' => $by?->id,
                'note' => $note,
                'starts_at' => $start,
                'ends_at' => $start->copy()->addDays($days),
            ]);
            $this->refresh($owner);

            return $grant;
        });
    }

    /**
     * Період підписки: триває до дати продовження (+ запас), після скасування — до кінця оплаченого.
     */
    public function syncSubscription(PlusSubscription $subscription): void
    {
        $owner = $this->owner($subscription->owner_type, $subscription->owner_id);
        if ($owner === null) {
            return;
        }

        $end = match (true) {
            in_array($subscription->status, PlusSubscription::RUNNING, true) && $subscription->renews_at !== null => $subscription->renews_at->copy()->addDays((int) config('plus.grace_days')),
            $subscription->status === 'cancelled' && $subscription->ends_at !== null => $subscription->ends_at,
            default => now(),
        };

        PlusGrant::query()->updateOrCreate(
            ['subscription_id' => $subscription->id],
            [
                'owner_type' => $subscription->owner_type,
                'owner_id' => $subscription->owner_id,
                'source' => 'subscription',
                'by_user_id' => $subscription->user_id,
                'starts_at' => $subscription->created_at,
                'ends_at' => $end,
            ],
        );
        $this->refresh($owner);
    }

    /** Знімає разові періоди (повернення коштів, рішення адміністратора). */
    public function revoke(PlusGrant $grant): void
    {
        $owner = $this->owner($grant->owner_type, $grant->owner_id);
        $grant->update(['ends_at' => now()]);
        if ($owner !== null) {
            $this->refresh($owner);
        }
    }

    public function refresh(User|Family $owner): void
    {
        $until = PlusGrant::query()
            ->where('owner_type', $this->type($owner))->where('owner_id', $owner->id)
            ->where('starts_at', '<=', now())
            ->max('ends_at');
        // Чергу періодів рахуємо як безперервну: беремо найпізніший кінець.
        $latest = PlusGrant::query()
            ->where('owner_type', $this->type($owner))->where('owner_id', $owner->id)
            ->max('ends_at');
        $value = $until !== null && now()->lt($until) ? $latest : null;

        $owner->forceFill(['plus_until' => $value])->saveQuietly();
    }

    public function redeem(User $user, string $code): PlusGrant
    {
        return DB::transaction(function () use ($user, $code) {
            $row = PlusCode::query()->where('code', mb_strtoupper(trim($code)))->lockForUpdate()->first();
            abort_unless($row !== null && $row->usable(), 422, 'Промокод недійсний або вже використаний.');
            abort_if($row->redemptions()->where('user_id', $user->id)->exists(), 422, 'Ви вже використали цей промокод.');

            $row->redemptions()->create(['user_id' => $user->id]);
            $row->increment('uses');

            return $this->grant($user, $row->days, 'code', note: $row->code);
        });
    }

    /**
     * Стан для сторінки GameCon+.
     *
     * @return array<string, mixed>
     */
    public function state(User|Family $owner): array
    {
        $subscription = PlusSubscription::query()
            ->where('owner_type', $this->type($owner))->where('owner_id', $owner->id)
            ->whereNotIn('status', ['expired'])
            ->latest('id')->first();

        return [
            'active' => $owner->isPlus(),
            'until' => $owner->plus_until?->toIso8601String(),
            'subscription' => $subscription ? [
                'product' => $subscription->product,
                'status' => $subscription->status,
                'renews_at' => $subscription->renews_at?->toIso8601String(),
                'ends_at' => $subscription->ends_at?->toIso8601String(),
                'portal_url' => $subscription->portal_url,
            ] : null,
        ];
    }

    public function owner(string $type, int $id): User|Family|null
    {
        return match ($type) {
            'user' => User::query()->find($id),
            'family' => Family::query()->find($id),
            default => null,
        };
    }

    public function type(User|Family $owner): string
    {
        return $owner instanceof Family ? 'family' : 'user';
    }
}
