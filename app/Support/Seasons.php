<?php

namespace App\Support;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;

/**
 * Сезонні прикраси сайту: Новий рік і Різдво, День закоханих, Великдень, День Незалежності,
 * Хелловін. Сезон визначається за датою в Києві; адміністратор може вимкнути прикраси
 * або показати потрібний сезон уже зараз (Адмінка → Дизайн), людина — вимкнути в себе.
 */
class Seasons
{
    public const SETTING = 'seasonal';

    public const ALL = ['newyear', 'valentine', 'easter', 'independence', 'halloween'];

    public function __construct(private readonly SiteSettings $settings) {}

    /** Режим з адмінки: auto, off або id сезону (показати зараз). */
    public function setting(): string
    {
        $value = (string) $this->settings->get(self::SETTING, 'auto');

        return in_array($value, ['auto', 'off', ...self::ALL], true) ? $value : 'auto';
    }

    /** Сезон, який бачить людина (або null). */
    public function for(?User $user, ?CarbonImmutable $now = null): ?string
    {
        if ($user !== null && $user->pref('seasonal') === false) {
            return null;
        }
        $setting = $this->setting();
        if ($setting === 'off') {
            return null;
        }

        return $setting === 'auto' ? self::byDate($now ?? CarbonImmutable::now('Europe/Kyiv')) : $setting;
    }

    public static function byDate(CarbonImmutable $date): ?string
    {
        $md = (int) $date->format('md');
        $easter = self::orthodoxEaster($date->year);
        $daysToEaster = (int) $date->startOfDay()->diffInDays($easter, false);

        return match (true) {
            $md >= 1215 || $md <= 114 => 'newyear', // Новий рік і обидва Різдва
            $md >= 210 && $md <= 214 => 'valentine',
            $daysToEaster <= 7 && $daysToEaster >= -3 => 'easter',
            $md >= 820 && $md <= 825 => 'independence',
            $md >= 1028 && $md <= 1101 => 'halloween',
            default => null,
        };
    }

    /** Православний Великдень (юліанський розрахунок, переведений у григоріанський календар). */
    public static function orthodoxEaster(int $year): CarbonImmutable
    {
        $a = $year % 4;
        $b = $year % 7;
        $c = $year % 19;
        $d = (19 * $c + 15) % 30;
        $e = (2 * $a + 4 * $b - $d + 34) % 7;
        $month = intdiv($d + $e + 114, 31);
        $day = (($d + $e + 114) % 31) + 1;
        // Різниця юліанського й григоріанського календарів: 13 днів для 1900–2099.
        $shift = intdiv($year, 100) - intdiv($year, 400) - 2;

        return CarbonImmutable::create($year, $month, $day, 0, 0, 0, 'Europe/Kyiv')->addDays($shift);
    }
}
