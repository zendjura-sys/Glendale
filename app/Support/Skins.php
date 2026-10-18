<?php

namespace App\Support;

use App\Models\User;

/**
 * Стиль інтерфейсу (Налаштування → Вигляд): той самий сайт і ті самі іконки, різна «оболонка».
 *   gamecon  — основний: розкладка класичної соцмережі, матове скло без рамок;
 *              темна тема «Неоновий синій», світла — «Крижана Арктика»;
 *   flat     — пласкі поверхні в дусі Apple, без об'єму й відблисків;
 *   hero     — HeroUI + glassmorphism;
 *   material — Material Design 3 + аврора й матове скло;
 *   flex     — Flex UI (компактна сітка) + liquid glass.
 * Ставиться на <html data-skin> ще на сервері, тож сторінка не «блимає».
 *
 * Тема (світла / темна / як на пристрої) — окремо від стилю. Світла є лише в «gamecon»,
 * решта стилів задумані темними й лишаються темними.
 */
class Skins
{
    public const DEFAULT = 'gamecon';

    public const ALL = ['gamecon', 'flat', 'hero', 'material', 'flex'];

    /** Стилі зі світлою темою. */
    public const WITH_LIGHT = ['gamecon'];

    public const THEMES = ['system', 'dark', 'light'];

    public static function for(?User $user): string
    {
        $skin = (string) $user?->pref('skin', self::DEFAULT);

        return in_array($skin, self::ALL, true) ? $skin : self::DEFAULT;
    }

    /** Вибір людини: system (як на пристрої), dark або light. */
    public static function theme(?User $user): string
    {
        $theme = (string) $user?->pref('theme', 'system');

        return in_array($theme, self::THEMES, true) ? $theme : 'system';
    }

    /**
     * Тема, яку сервер ставить на <html> одразу. «Як на пристрої» уточнює скрипт у <head>
     * до першого кадру; стилі без світлої теми завжди темні.
     */
    public static function initialTheme(?User $user): string
    {
        return self::theme($user) === 'light' && in_array(self::for($user), self::WITH_LIGHT, true) ? 'light' : 'dark';
    }
}
