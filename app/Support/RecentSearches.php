<?php

namespace App\Support;

use App\Models\User;

/**
 * Останні запити швидкого пошуку. Лише для власника акаунта.
 */
class RecentSearches
{
    /**
     * @return list<string>
     */
    public static function list(User $user): array
    {
        $stored = $user->pref('recent_searches', []);
        if (! is_array($stored)) {
            return [];
        }

        return array_values(array_filter($stored, fn ($item) => is_string($item) && $item !== ''));
    }

    public static function remember(User $user, string $query): void
    {
        $query = trim($query);
        if (mb_strlen($query) < 2) {
            return;
        }
        $query = mb_substr($query, 0, 80);
        $recent = array_values(array_filter(
            self::list($user),
            fn (string $item) => mb_strtolower($item) !== mb_strtolower($query),
        ));
        array_unshift($recent, $query);
        $user->mergePref(['recent_searches' => array_slice($recent, 0, 8)]);
    }
}
