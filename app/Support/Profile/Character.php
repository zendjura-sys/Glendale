<?php

namespace App\Support\Profile;

use Illuminate\Validation\ValidationException;

/**
 * Персонаж-аватар: скільки варіантів має кожна частина. Ті самі межі — у resources/js/lib/character.ts.
 */
class Character
{
    public const PARTS = [
        'sex' => 2,
        'skin' => 10,
        'build' => 4,
        'head' => 8,
        'hair' => 30,
        'hairColor' => 11,
        'eyes' => 8,
        'eyeTilt' => 3,
        'eyeGap' => 5,
        'eyeSize' => 5,
        'eyeColor' => 7,
        'lashes' => 3,
        'brows' => 5,
        'nose' => 4,
        'lips' => 5,
        'lipColor' => 6,
        'mouth' => 5,
        'makeup' => 6,
        'beard' => 5,
        'extra' => 7,
        'earrings' => 3,
        'tattoo' => 6,
        'outfit' => 14,
        'outfitColor' => 9,
        'bg' => 9,
    ];

    /** Варіант за замовчуванням, якщо частину не передали (посередині шкали — для посадки й розміру очей). */
    public const DEFAULTS = ['eyeGap' => 2, 'eyeSize' => 2];

    /**
     * Перевіряє й нормалізує набір: лише відомі частини, цілі числа в межах.
     *
     * @return array<string, int>
     */
    public static function clean(mixed $value): array
    {
        if (! is_array($value)) {
            throw ValidationException::withMessages(['character' => 'Персонажа не збережено: невідомий формат.']);
        }
        $out = [];
        foreach (self::PARTS as $part => $count) {
            $v = $value[$part] ?? (self::DEFAULTS[$part] ?? 0);
            if (! is_int($v) && ! (is_string($v) && ctype_digit($v))) {
                throw ValidationException::withMessages(['character' => 'Персонажа не збережено: невідома частина.']);
            }
            $v = (int) $v;
            if ($v < 0 || $v >= $count) {
                throw ValidationException::withMessages(['character' => 'Персонажа не збережено: такого варіанта немає.']);
            }
            $out[$part] = $v;
        }

        return $out;
    }
}
