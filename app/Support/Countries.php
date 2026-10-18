<?php

namespace App\Support;

/** Країни для стрічки «свої». Код — ISO 3166-1 alpha-2. */
class Countries
{
    /** @var array<string, string> */
    public const NAMES = [
        'UA' => 'Україна',
        'PL' => 'Польща',
        'DE' => 'Німеччина',
        'CZ' => 'Чехія',
        'SK' => 'Словаччина',
        'RO' => 'Румунія',
        'MD' => 'Молдова',
        'LT' => 'Литва',
        'LV' => 'Латвія',
        'EE' => 'Естонія',
        'GE' => 'Грузія',
        'KZ' => 'Казахстан',
        'TR' => 'Туреччина',
        'FR' => 'Франція',
        'ES' => 'Іспанія',
        'IT' => 'Італія',
        'GB' => 'Велика Британія',
        'US' => 'США',
        'CA' => 'Канада',
    ];

    /**
     * @return list<array{code: string, name: string}>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::NAMES as $code => $name) {
            $options[] = ['code' => $code, 'name' => $name];
        }

        return $options;
    }
}
