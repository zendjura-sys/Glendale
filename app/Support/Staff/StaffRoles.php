<?php

namespace App\Support\Staff;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Ролі команди: модератору адміністратор відкриває окремі розділи адмінки.
 * Гроші, ключі, налаштування, користувачі й система лишаються тільки адміністраторам.
 */
class StaffRoles
{
    /** Розділи, які можна доручити модератору (ключ — перший сегмент шляху після /admin/). */
    public const SECTIONS = [
        'moderation' => 'Модерація',
        'verification' => 'Верифікація',
        'antispam' => 'Антиспам',
        'chats' => 'Статистика чатів',
        'posts' => 'Записи',
        'photos' => 'Фото',
        'communities' => 'Спільноти',
        'music' => 'Музика',
        'cinema' => 'Кіно',
        'servers' => 'Сервери',
        'games' => 'Ігри',
        'families' => 'Сім’ї',
        'stickers' => 'Стікери',
        'seasons' => 'Сезони',
        'status' => 'Статус',
    ];

    /**
     * @return list<string>
     */
    public static function sections(User $user): array
    {
        if ($user->isAdmin()) {
            return array_keys(self::SECTIONS);
        }
        if (! $user->isStaff()) {
            return [];
        }
        // Особисто доручені розділи плюс розділи ролі команди (Адмінка → Команда → Ролі).
        $saved = array_merge((array) $user->staff_sections, $user->staffRole?->cleanSections() ?? []);

        return array_values(array_unique(array_filter($saved, fn ($s) => is_string($s) && array_key_exists($s, self::SECTIONS))));
    }

    /** Розділ адмінки, до якого веде запит (null — головна /admin). */
    public static function sectionOf(Request $request): ?string
    {
        $segments = $request->segments();

        return ($segments[0] ?? null) === 'admin' ? ($segments[1] ?? null) : null;
    }

    public static function allows(User $user, ?string $section): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $section !== null && in_array($section, self::sections($user), true);
    }
}
