<?php

namespace App\Services\Plus;

use App\Models\Family;
use App\Models\PlusGrant;
use App\Models\PlusRenewal;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * GameCon+: періоди доступу (plus_grants) і кешований статус plus_until у власника.
 *
 * Покупки з рахунку, автопродовження, подарунки, промокоди й видача адміністратором складаються
 * в чергу одне за одним; підписка Google Play — окремий період, що рухається разом з оплаченим.
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
     * Період зовнішньої підписки (Google Play): рухається разом із кінцем оплаченого періоду; після скасування — до його кінця.
     */
    public function syncSubscription(User|Family $owner, int $subscriptionId, ?User $payer, ?CarbonInterface $startedAt, CarbonInterface $end): void
    {
        PlusGrant::query()->updateOrCreate(
            ['subscription_id' => $subscriptionId],
            [
                'owner_type' => $this->type($owner),
                'owner_id' => $owner->id,
                'source' => 'subscription',
                'by_user_id' => $payer?->id,
                'starts_at' => $startedAt ?? now(),
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

    /**
     * Стан для сторінки GameCon+ і рахунку: до коли діє й чи ввімкнене автопродовження.
     *
     * @return array<string, mixed>
     */
    public function state(User|Family $owner): array
    {
        $renewal = PlusRenewal::query()->where('owner_type', $this->type($owner))->where('owner_id', $owner->id)->where('active', true)->first();

        return [
            'active' => $owner->isPlus(),
            'until' => $owner->plus_until?->toIso8601String(),
            'renewal' => $renewal ? [
                'id' => $renewal->id,
                'product' => $renewal->product,
                'payer_id' => $renewal->user_id,
                'failed' => $renewal->failed_at !== null,
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
