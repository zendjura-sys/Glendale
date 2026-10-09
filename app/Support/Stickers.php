<?php

namespace App\Support;

/** Невеликий набір стікерів для постів і коментарів. Ключ зберігається в базі, емодзі показується в картці. */
class Stickers
{
    /** @var array<string, string> */
    public const ITEMS = [
        'gg' => '🏆',
        'fire' => '🔥',
        'heart' => '💜',
        'laugh' => '😂',
        'clap' => '👏',
        'game' => '🎮',
        'star' => '⭐',
        'cool' => '😎',
    ];

    public static function emoji(?string $key): ?string
    {
        return self::ITEMS[$key] ?? null;
    }
}
