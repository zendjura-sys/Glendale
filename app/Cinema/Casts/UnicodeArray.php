<?php

namespace App\Cinema\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Як стандартний 'array'-каст, але без \uXXXX-екранування кирилиці —
 * інакше LIKE-пошук по JSON-стовпцю (alt_names) не знаходить нічого,
 * бо в базі лежать самі escape-послідовності, а не текст.
 */
final class UnicodeArray implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        return $value === null ? null : (json_decode((string) $value, true) ?? []);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
