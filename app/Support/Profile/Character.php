<?php

namespace App\Support\Profile;

use Illuminate\Validation\ValidationException;

/**
 * Персонаж-аватар: скільки варіантів має кожна частина. Ті самі межі — у resources/js/lib/character.ts.
 */
class Character
{
    public const PARTS = [
        'skin' => 10,
        'freckles' => 2,
        'blush' => 2,
        'head' => 5,
        'hair' => 18,
        'hairColor' => 14,
        'hairOmbre' => 2,
        'eyes' => 11,
        'pupil' => 6,
        'eyeColor' => 12,
        'eyeColorRight' => 12,
        'hetero' => 2,
        'brows' => 6,
        'nose' => 5,
        'mouth' => 6,
        'lipTint' => 6,
        'facialHair' => 10,
        'extra' => 8,
        'outfit' => 4,
        'outfitColor' => 9,
        'bg' => 9,
        // 0 — чоловічий, 1 — жіночий (набір зачісок, очей, борода)
        'gender' => 2,
        // Вуса окремо від бороди; колір бороди й вусів (0 — як волосся)
        'mustache' => 6,
        'beardColor' => 15,
        // Редактор обличчя: зсув від центру (10 — без зсуву)
        'eyeY' => 21,
        'eyeSpread' => 21,
        'noseY' => 21,
        'mouthY' => 21,
    ];

    /** Варіант за замовчуванням, якщо частину не передали (як DEFAULT_CHARACTER на клієнті). */
    public const DEFAULTS = ['skin' => 5, 'hair' => 1, 'hairColor' => 1, 'eyeY' => 10, 'eyeSpread' => 10, 'noseY' => 10, 'mouthY' => 10];

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
