<?php

namespace App\Support;

use App\Support\Settings\SiteSettings;

/** Техроботи в окремому розділі (модулі): повідомлення для людей, поки команда працює. */
class Maintenance
{
    public const DEFAULT_MESSAGE = 'Розділ на технічних роботах — скоро повернемося.';

    /** Повідомлення про техроботи в модулі або null, якщо розділ працює. */
    public static function message(string $module): ?string
    {
        $all = self::all();

        return $all[$module] ?? null;
    }

    /**
     * @return array<string, string>
     */
    public static function all(): array
    {
        $value = app(SiteSettings::class)->get('maintenance_modules', []);
        if (! is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $module => $message) {
            if (is_string($module) && is_string($message) && $message !== '') {
                $out[$module] = $message;
            }
        }

        return $out;
    }
}
