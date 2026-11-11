<?php

namespace App\Support\Profile;

use Illuminate\Validation\ValidationException;

/**
 * Персонаж-аватар: скільки варіантів має кожна частина. Ті самі межі — у resources/js/lib/character.ts.
 */
class Character
{
    public const PARTS = [
        'skin' => 8,
        'head' => 4,
        'hair' => 10,
        'hairColor' => 9,
        'eyes' => 5,
        'eyeColor' => 5,
        'brows' => 4,
        'nose' => 4,
        'mouth' => 5,
        'beard' => 5,
        'extra' => 7,
        'outfit' => 4,
        'outfitColor' => 8,
        'bg' => 8,
    ];

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
            $v = $value[$part] ?? 0;
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
