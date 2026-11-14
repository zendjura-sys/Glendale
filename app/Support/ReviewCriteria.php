<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Критерії оцінки в оглядах: для ігор — сюжет, графіка, звук, геймплей; для кіно — сюжет, візуал,
 * звук, акторська гра. Кожен 1–10 і необов’язковий; середні рахуються лише з тих, хто поставив.
 */
class ReviewCriteria
{
    public const GAME = ['story', 'graphics', 'sound', 'gameplay'];

    public const MOVIE = ['story', 'visuals', 'sound', 'acting'];

    /**
     * Правила валідації для запиту.
     *
     * @param  list<string>  $keys
     * @return array<string, list<string>>
     */
    public static function rules(array $keys): array
    {
        $rules = ['criteria' => ['nullable', 'array']];
        foreach ($keys as $key) {
            $rules["criteria.{$key}"] = ['nullable', 'integer', 'min:1', 'max:10'];
        }

        return $rules;
    }

    /**
     * Лише відомі критерії з оцінкою.
     *
     * @param  list<string>  $keys
     * @return array<string, int>|null
     */
    public static function clean(mixed $input, array $keys): ?array
    {
        $out = [];
        foreach ($keys as $key) {
            $v = is_array($input) ? ($input[$key] ?? null) : null;
            if (is_numeric($v) && (int) $v >= 1 && (int) $v <= 10) {
                $out[$key] = (int) $v;
            }
        }

        return $out === [] ? null : $out;
    }

    /**
     * Середня оцінка за кожним критерієм (null — ще ніхто не оцінив).
     *
     * @param  Builder<Model>  $query
     * @param  list<string>  $keys
     * @return array<string, float|null>
     */
    public static function averages(Builder $query, array $keys): array
    {
        $sum = array_fill_keys($keys, 0);
        $count = array_fill_keys($keys, 0);
        $query->whereNotNull('criteria')->pluck('criteria')->each(function ($c) use (&$sum, &$count, $keys) {
            $c = is_array($c) ? $c : (json_decode((string) $c, true) ?: []);
            foreach ($keys as $key) {
                if (isset($c[$key])) {
                    $sum[$key] += (int) $c[$key];
                    $count[$key]++;
                }
            }
        });

        return array_map(fn (string $k) => $count[$k] > 0 ? round($sum[$k] / $count[$k], 1) : null, array_combine($keys, $keys));
    }
}
