<?php

namespace App\Services\Engagement;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Carbon\CarbonImmutable;

/**
 * Серія днів поспіль: заходили сьогодні — день додається, пропустили день — серія починається знову.
 * День рахується за київським часом; оновлення — раз на день із запиту людини.
 */
class Streaks
{
    /** Пороги, на яких серія «святкується» (значок і картка в профілі). */
    public const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

    public function touch(User $user): void
    {
        if (! app(Plugins::class)->on('streaks')) {
            return;
        }
        $today = CarbonImmutable::now('Europe/Kyiv')->startOfDay();
        $last = $user->streak_on === null ? null : CarbonImmutable::parse($user->streak_on->toDateString(), 'Europe/Kyiv');
        if ($last !== null && $last->equalTo($today)) {
            return;
        }
        $days = $last !== null && $last->equalTo($today->subDay()) ? $user->streak_days + 1 : 1;
        $user->forceFill([
            'streak_days' => $days,
            'streak_best' => max($user->streak_best, $days),
            'streak_on' => $today->toDateString(),
        ])->saveQuietly();
    }

    /**
     * Серія для картки й профілю: зламана (учора не заходили) — 0.
     *
     * @return array{days: int, best: int, milestone: int|null}|null
     */
    public function state(User $user): ?array
    {
        if (! app(Plugins::class)->on('streaks') || $user->streak_on === null) {
            return null;
        }
        $today = CarbonImmutable::now('Europe/Kyiv')->startOfDay();
        $last = CarbonImmutable::parse($user->streak_on->toDateString(), 'Europe/Kyiv');
        $days = $last->greaterThanOrEqualTo($today->subDay()) ? $user->streak_days : 0;
        $milestone = null;
        foreach (self::MILESTONES as $step) {
            if ($days >= $step) {
                $milestone = $step;
            }
        }

        return ['days' => $days, 'best' => $user->streak_best, 'milestone' => $milestone];
    }
}
