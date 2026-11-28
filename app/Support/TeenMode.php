<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Підлітковий режим. Вмикається сам для 13–17 років за датою народження (і не вимикається
 * до 18), дорослий може ввімкнути його для себе. Що робить:
 * писати в особисті можуть лише друзі; незнайомі дорослі не бачать підлітка в пошуку людей
 * і «можливих знайомих»; образливі слова приховано завжди; оголошення паті 18+ не показуються.
 */
class TeenMode
{
    public const AGE = 18;

    /** За датою народження людині менше 18 — режим не вимикається. */
    public static function locked(User $user): bool
    {
        $age = $user->birthday?->age;

        return $age !== null && $age < self::AGE;
    }

    public static function on(User $user): bool
    {
        return self::locked($user) || (bool) $user->pref('teen_mode', false);
    }

    /** Приховати мат: власний вибір людини або підлітковий режим. */
    public static function hidesProfanity(User $user): bool
    {
        return self::on($user) || (bool) $user->pref('hide_profanity', false);
    }

    /**
     * Прибрати з вибірки людей у підлітковому режимі — для пошуку й рекомендацій
     * незнайомим дорослим. Підліток бачить інших підлітків як завжди.
     *
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public static function hideFrom(Builder $query, ?User $viewer): Builder
    {
        if ($viewer !== null && self::on($viewer)) {
            return $query;
        }

        return $query
            ->where(fn (Builder $q) => $q->whereNull('birthday')->orWhere('birthday', '<=', now()->subYears(self::AGE)->toDateString()))
            ->where(fn (Builder $q) => $q->whereNull('preferences->teen_mode')->orWhere('preferences->teen_mode', false));
    }

    /**
     * @return array{on: bool, locked: bool}
     */
    public static function state(User $user): array
    {
        return ['on' => self::on($user), 'locked' => self::locked($user)];
    }
}
