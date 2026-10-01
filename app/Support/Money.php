<?php

namespace App\Support;

/**
 * Внутрішня валюта сімей (₴). У базі — копійки, у формах — гривні з копійками.
 */
final class Money
{
    public static function toMinor(float|int|string|null $hryvnias): int
    {
        return (int) round(((float) str_replace([' ', ','], ['', '.'], (string) $hryvnias)) * 100);
    }

    public static function format(int $minor): string
    {
        $negative = $minor < 0;
        $minor = abs($minor);
        $whole = number_format(intdiv($minor, 100), 0, ',', ' ');
        $cents = $minor % 100;

        return ($negative ? '−' : '').$whole.($cents ? ','.str_pad((string) $cents, 2, '0', STR_PAD_LEFT) : '').' ₴';
    }
}
