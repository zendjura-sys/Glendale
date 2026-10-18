<?php

namespace App\Support;

use App\Models\User;

/**
 * Стиль інтерфейсу (Налаштування → Вигляд): той самий сайт і ті самі іконки, різна «оболонка».
 *   flat     — основний: пласкі поверхні в дусі Apple, без об'єму й відблисків;
 *   hero     — HeroUI + glassmorphism;
 *   material — Material Design 3 + аврора й матове скло;
 *   flex     — Flex UI (компактна сітка) + liquid glass.
 * Ставиться на <html data-skin> ще на сервері, тож сторінка не «блимає».
 */
class Skins
{
    public const DEFAULT = 'flat';

    public const ALL = ['flat', 'hero', 'material', 'flex'];

    public static function for(?User $user): string
    {
        $skin = (string) $user?->pref('skin', self::DEFAULT);

        return in_array($skin, self::ALL, true) ? $skin : self::DEFAULT;
    }
}
