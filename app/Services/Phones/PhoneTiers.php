<?php

namespace App\Services\Phones;

/**
 * Рівень номера за цифрами (7 цифр і код оператора). Від найрідшого:
 *  diamond  — усі 7 цифр однакові, і код оператора з тих самих цифр: (77) 777-77-77;
 *  platinum — 6 однакових цифр поспіль (або всі 7, якщо код оператора інший);
 *  gold     — 4–5 однакових цифр поспіль або «драбинка» 1234567 / 7654321;
 *  silver   — три однакові пари (1-23-23-23) або дзеркальний номер (1234321);
 *  bronze   — дві однакові пари в кінці (45-45) або 3 однакові цифри поспіль;
 *  regular  — решта.
 */
class PhoneTiers
{
    public const ALL = ['regular', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

    public static function detect(string $operator, string $digits): string
    {
        $run = self::longestRun($digits);
        if ($run === 7) {
            return $operator === $digits[0].$digits[0] ? 'diamond' : 'platinum';
        }

        return match (true) {
            $run === 6 => 'platinum',
            $run >= 4 || self::ladder($digits) => 'gold',
            (substr($digits, 1, 2) === substr($digits, 3, 2) && substr($digits, 3, 2) === substr($digits, 5, 2)) || $digits === strrev($digits) => 'silver',
            substr($digits, 3, 2) === substr($digits, 5, 2) || $run === 3 => 'bronze',
            default => 'regular',
        };
    }

    public static function rank(string $tier): int
    {
        return (int) array_search($tier, self::ALL, true);
    }

    /**
     * Випадковий номер потрібного рівня (кандидат; зайнятість перевіряє PhoneNumbers).
     *
     * @return array{0: string, 1: string} [operator, digits]
     */
    public static function generate(string $tier, ?string $operator = null): array
    {
        $digit = fn () => (string) random_int(0, 9);
        $digitsOf = fn (int $n) => implode('', array_map(fn () => $digit(), range(1, $n)));
        $op = $operator ?? sprintf('%02d', random_int(1, 99));

        $digits = match ($tier) {
            'diamond' => str_repeat((string) random_int(1, 9), 7),
            'platinum' => random_int(0, 1) === 0 ? $digit().str_repeat($digit(), 6) : str_repeat($digit(), 6).$digit(),
            'gold' => random_int(0, 2) === 0 ? self::ladderOf() : self::withRun(random_int(4, 5)),
            'silver' => random_int(0, 1) === 0 ? $digit().str_repeat($digitsOf(2), 3) : self::mirror(),
            'bronze' => random_int(0, 1) === 0 ? $digitsOf(3).str_repeat($digitsOf(2), 2) : self::withRun(3),
            default => $digitsOf(7),
        };
        if ($tier === 'diamond') {
            $op = $digits[0].$digits[0];
        }

        return [$op, $digits];
    }

    private static function longestRun(string $digits): int
    {
        $best = 1;
        $current = 1;
        for ($i = 1; $i < strlen($digits); $i++) {
            $current = $digits[$i] === $digits[$i - 1] ? $current + 1 : 1;
            $best = max($best, $current);
        }

        return $best;
    }

    private static function ladder(string $digits): bool
    {
        return str_contains('0123456789', $digits) || str_contains('9876543210', $digits);
    }

    private static function ladderOf(): string
    {
        $start = random_int(0, 3);
        $up = substr('0123456789', $start, 7);

        return random_int(0, 1) === 0 ? $up : strrev($up);
    }

    private static function withRun(int $length): string
    {
        $digits = '';
        for ($i = 0; $i < 7; $i++) {
            $digits .= (string) random_int(0, 9);
        }
        $at = random_int(0, 7 - $length);

        return substr_replace($digits, str_repeat((string) random_int(0, 9), $length), $at, $length);
    }

    private static function mirror(): string
    {
        $half = '';
        for ($i = 0; $i < 4; $i++) {
            $half .= (string) random_int(0, 9);
        }

        return $half.strrev(substr($half, 0, 3));
    }
}
