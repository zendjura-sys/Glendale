<?php

namespace App\Support\LiveCast;

/**
 * Подарунки в ефірі LiveCast (реакції в чаті; без окремого балансу).
 */
final class StreamGifts
{
    /**
     * @return list<array{key: string, emoji: string, label: string}>
     */
    public static function all(): array
    {
        return [
            ['key' => 'rose', 'emoji' => '🌹', 'label' => 'Троянда'],
            ['key' => 'fire', 'emoji' => '🔥', 'label' => 'Вогонь'],
            ['key' => 'heart', 'emoji' => '💜', 'label' => 'Серце'],
            ['key' => 'star', 'emoji' => '⭐', 'label' => 'Зірка'],
            ['key' => 'clap', 'emoji' => '👏', 'label' => 'Оплески'],
            ['key' => 'gg', 'emoji' => '🎮', 'label' => 'GG'],
            ['key' => 'rocket', 'emoji' => '🚀', 'label' => 'Ракета'],
            ['key' => 'crown', 'emoji' => '👑', 'label' => 'Корона'],
        ];
    }

    /** @return array{key: string, emoji: string, label: string}|null */
    public static function find(string $key): ?array
    {
        foreach (self::all() as $gift) {
            if ($gift['key'] === $key) {
                return $gift;
            }
        }

        return null;
    }
}
