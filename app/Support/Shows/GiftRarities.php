<?php

namespace App\Support\Shows;

/**
 * Рідкості подарунків GameCast: від «сміття» до унікалу.
 */
final class GiftRarities
{
    public const TRASH = 'trash';

    public const COMMON = 'common';

    public const FRESH = 'fresh';

    public const ADVANCED = 'advanced';

    public const RARE = 'rare';

    public const EPIC = 'epic';

    public const LEGENDARY = 'legendary';

    public const MYTHICAL = 'mythical';

    public const DIVINE = 'divine';

    public const UNIQUE = 'unique';

    /** Рідкості від rare і вище — для pity. */
    public const PITY_FLOOR = [
        self::RARE, self::EPIC, self::LEGENDARY, self::MYTHICAL, self::DIVINE, self::UNIQUE,
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return [
            self::TRASH, self::COMMON, self::FRESH, self::ADVANCED, self::RARE,
            self::EPIC, self::LEGENDARY, self::MYTHICAL, self::DIVINE, self::UNIQUE,
        ];
    }

    /** @return array{key: string, label: string, tone: string, order: int} */
    public static function meta(string $key): ?array
    {
        return self::catalog()[$key] ?? null;
    }

    /**
     * @return array<string, array{key: string, label: string, tone: string, order: int}>
     */
    public static function catalog(): array
    {
        $rows = [
            [self::TRASH, 'Сміття', 'stone', 0],
            [self::COMMON, 'Звичайний', 'slate', 1],
            [self::FRESH, 'Новий', 'sky', 2],
            [self::ADVANCED, 'Просунутий', 'cyan', 3],
            [self::RARE, 'Рідкісний', 'violet', 4],
            [self::EPIC, 'Епічний', 'fuchsia', 5],
            [self::LEGENDARY, 'Легендарний', 'amber', 6],
            [self::MYTHICAL, 'Міфічний', 'rose', 7],
            [self::DIVINE, 'Божественний', 'yellow', 8],
            [self::UNIQUE, 'Унікальний', 'emerald', 9],
        ];
        $out = [];
        foreach ($rows as [$key, $label, $tone, $order]) {
            $out[$key] = compact('key', 'label', 'tone', 'order');
        }

        return $out;
    }

    public static function isPityTier(string $rarity): bool
    {
        return in_array($rarity, self::PITY_FLOOR, true);
    }

    /**
     * Нормалізувати ваги рідкостей (сума може бути будь-яка).
     *
     * @return array<string, int>
     */
    public static function sanitizeOdds(mixed $raw): array
    {
        $out = [];
        if (! is_array($raw)) {
            return self::defaultOdds();
        }
        foreach (self::keys() as $key) {
            $w = (int) ($raw[$key] ?? 0);
            $out[$key] = max(0, min(1_000_000, $w));
        }
        if (array_sum($out) <= 0) {
            return self::defaultOdds();
        }

        return $out;
    }

    /** @return array<string, int> */
    public static function defaultOdds(): array
    {
        return [
            self::TRASH => 2200,
            self::COMMON => 2600,
            self::FRESH => 1800,
            self::ADVANCED => 1400,
            self::RARE => 900,
            self::EPIC => 500,
            self::LEGENDARY => 220,
            self::MYTHICAL => 90,
            self::DIVINE => 30,
            self::UNIQUE => 10,
        ];
    }
}
