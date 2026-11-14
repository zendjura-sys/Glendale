<?php

namespace App\Services\Plus;

use App\Models\PlusGrant;
use App\Models\User;
use App\Notifications\BillingNotice;
use App\Services\Billing\Catalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Пробний період GameCon+ на сайті: один раз на акаунт, без картки й без автосписання.
 * Тривалість — правило білінгу trial_days (0 — вимкнено). Право: пошта підтверджена,
 * акаунту більше доби, GameCon+ раніше не було. За добу до кінця — нагадування.
 */
class PlusTrial
{
    public function __construct(private readonly Plus $plus, private readonly Catalog $catalog) {}

    public function days(): int
    {
        return (int) ($this->catalog->rules()['trial_days'] ?? 0);
    }

    /** Чому не можна (null — можна). */
    public function blocker(User $user): ?string
    {
        return match (true) {
            $this->days() < 1 => 'Пробний період зараз не діє.',
            $user->plus_trial_at !== null => 'Пробний період уже використано.',
            $user->isPlus() || PlusGrant::query()->where('owner_type', 'user')->where('owner_id', $user->id)->exists() => 'Пробний період — лише для тих, у кого ще не було GameCon+.',
            $user->email_verified_at === null => 'Підтвердьте пошту, щоб увімкнути пробний період.',
            $user->created_at !== null && $user->created_at->gt(now()->subDay()) => 'Пробний період стане доступним через добу після реєстрації.',
            default => null,
        };
    }

    public function eligible(User $user): bool
    {
        return $this->blocker($user) === null;
    }

    public function start(User $user): PlusGrant
    {
        if (($why = $this->blocker($user)) !== null) {
            throw ValidationException::withMessages(['trial' => $why]);
        }

        return DB::transaction(function () use ($user) {
            $user->forceFill(['plus_trial_at' => now()])->save();
            $grant = $this->plus->grant($user, $this->days(), 'trial', note: 'Пробний період');
            Log::info('plus: trial started', ['user' => $user->id, 'days' => $this->days()]);

            return $grant;
        });
    }

    /** Нагадати за добу до кінця пробного періоду (без продовження вручну він просто завершиться). */
    public function remind(): int
    {
        $users = User::query()->whereNotNull('plus_trial_at')->whereNull('plus_trial_reminded_at')
            ->whereBetween('plus_until', [now(), now()->addDay()])->limit(500)->get();
        foreach ($users as $user) {
            $user->forceFill(['plus_trial_reminded_at' => now()])->save();
            // Лише якщо після пробного періоду нічого не купили.
            if (PlusGrant::query()->where('owner_type', 'user')->where('owner_id', $user->id)->where('source', '!=', 'trial')->exists()) {
                continue;
            }
            $user->notify(new BillingNotice('plus_trial_ending', 'Завтра закінчується пробний період GameCon+. Залишити рамки, теми й анімований нік — оформіть підписку.'));
        }

        return $users->count();
    }
}
