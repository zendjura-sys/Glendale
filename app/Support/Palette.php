<?php

namespace App\Support;

/**
 * Іменовані палітри сайту. Фон лишається темним, міняються акцент і градієнт.
 */
class Palette
{
    public const DEFAULT = 'aurora';

    /**
     * @return list<array{id: string, name: string, colors: list<string>}>
     */
    public static function all(): array
    {
        return [
            ['id' => 'aurora', 'name' => 'Аврора', 'colors' => ['#4f8bff', '#6d5dfc', '#a855f7', '#f04fd8']],
            ['id' => 'ocean', 'name' => 'Океан', 'colors' => ['#38bdf8', '#0ea5e9', '#22d3ee', '#2dd4bf']],
            ['id' => 'forest', 'name' => 'Ліс', 'colors' => ['#34d399', '#10b981', '#14b8a6', '#84cc16']],
            ['id' => 'ember', 'name' => 'Вугілля', 'colors' => ['#fb7185', '#f97316', '#f59e0b', '#ef4444']],
            ['id' => 'sunset', 'name' => 'Захід', 'colors' => ['#fb923c', '#f43f5e', '#e879f9', '#facc15']],
            ['id' => 'royal', 'name' => 'Корона', 'colors' => ['#a78bfa', '#7c3aed', '#f5c451', '#c4b5fd']],
            ['id' => 'rose', 'name' => 'Троянда', 'colors' => ['#fb7185', '#f43f5e', '#fda4af', '#e879f9']],
            ['id' => 'sakura', 'name' => 'Сакура', 'colors' => ['#f9a8d4', '#f472b6', '#c084fc', '#fbcfe8']],
            ['id' => 'midnight', 'name' => 'Північ', 'colors' => ['#818cf8', '#6366f1', '#312e81', '#a5b4fc']],
            ['id' => 'ice', 'name' => 'Крига', 'colors' => ['#bae6fd', '#7dd3fc', '#67e8f9', '#e0f2fe']],
            ['id' => 'neon', 'name' => 'Неон', 'colors' => ['#22d3ee', '#e879f9', '#a3e635', '#38bdf8']],
            ['id' => 'venom', 'name' => 'Неон-лайм', 'colors' => ['#a3e635', '#84cc16', '#c084fc', '#bef264']],
            ['id' => 'gold', 'name' => 'Золото', 'colors' => ['#fbbf24', '#f59e0b', '#fde68a', '#d97706']],
            ['id' => 'blood', 'name' => 'Багрянець', 'colors' => ['#f43f5e', '#be123c', '#fb7185', '#9f1239']],
            ['id' => 'grape', 'name' => 'Виноград', 'colors' => ['#c084fc', '#a855f7', '#7e22ce', '#e9d5ff']],
            ['id' => 'arctic', 'name' => 'Арктика', 'colors' => ['#5eead4', '#38bdf8', '#a5f3fc', '#2dd4bf']],
            ['id' => 'candy', 'name' => 'Цукерка', 'colors' => ['#f472b6', '#22d3ee', '#facc15', '#a78bfa']],
            ['id' => 'sand', 'name' => 'Пісок', 'colors' => ['#fdba74', '#fcd34d', '#d6d3d1', '#fb923c']],
            ['id' => 'matrix', 'name' => 'Матриця', 'colors' => ['#4ade80', '#22c55e', '#86efac', '#16a34a']],
            ['id' => 'copper', 'name' => 'Мідь', 'colors' => ['#fb923c', '#ea580c', '#fdba74', '#c2410c']],
        ];
    }

    /**
     * @return list<string>|null
     */
    public static function colors(string $id): ?array
    {
        foreach (self::all() as $palette) {
            if ($palette['id'] === $id) {
                return $palette['colors'];
            }
        }

        return null;
    }

    public static function exists(string $id): bool
    {
        return in_array($id, array_column(self::all(), 'id'), true);
    }
}
