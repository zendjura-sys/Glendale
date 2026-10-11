<?php

namespace App\Support;

/**
 * Оформлення GameCon+: лише значення з config/plus.php — у фронтенд іде готовий список кольорів.
 */
class PlusStyle
{
    /**
     * @param  array<string, mixed>|null  $style
     * @return array{name: list<string>|null, frame: list<string>|null, fx: string|null}
     */
    public static function card(?array $style): array
    {
        $fx = $style['fx'] ?? null;

        return [
            'name' => self::colors('name_colors', $style['name'] ?? null),
            'frame' => self::frame($style['frame'] ?? null),
            'fx' => is_string($fx) && in_array($fx, (array) config('plus.name_effects'), true) ? $fx : null,
        ];
    }

    /**
     * Ефект шапки профілю (null — без ефекту).
     *
     * @param  array<string, mixed>|null  $style
     */
    public static function header(?array $style): ?string
    {
        $header = $style['header'] ?? null;

        return is_string($header) && in_array($header, (array) config('plus.header_effects'), true) ? $header : null;
    }

    /**
     * @param  array<string, mixed>|null  $style
     * @return array{accent: list<string>|null}
     */
    public static function familyCard(?array $style): array
    {
        $accent = $style['accent'] ?? null;

        return ['accent' => is_string($accent) ? Palette::colors($accent) : null];
    }

    /**
     * Дозволені варіанти для форми налаштувань.
     *
     * @return array{names: array<string, list<string>>, frames: array<string, list<string>>, accents: array<string, list<string>>, effects: list<string>, headers: list<string>}
     */
    public static function options(): array
    {
        $frames = [];
        foreach (array_keys((array) config('plus.frames')) as $key) {
            $frames[(string) $key] = self::frame((string) $key) ?? [];
        }

        return [
            'names' => (array) config('plus.name_colors'),
            'frames' => $frames,
            'accents' => array_column(Palette::all(), 'colors', 'id'),
            'effects' => array_values((array) config('plus.name_effects')),
            'headers' => array_values((array) config('plus.header_effects')),
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, string>
     */
    public static function clean(array $input): array
    {
        $out = [];
        if (is_string($input['name'] ?? null) && array_key_exists($input['name'], (array) config('plus.name_colors'))) {
            $out['name'] = $input['name'];
        }
        if (is_string($input['frame'] ?? null) && array_key_exists($input['frame'], (array) config('plus.frames'))) {
            $out['frame'] = $input['frame'];
        }
        if (is_string($input['accent'] ?? null) && Palette::exists($input['accent'])) {
            $out['accent'] = $input['accent'];
        }
        if (is_string($input['fx'] ?? null) && in_array($input['fx'], (array) config('plus.name_effects'), true)) {
            $out['fx'] = $input['fx'];
        }
        if (is_string($input['header'] ?? null) && in_array($input['header'], (array) config('plus.header_effects'), true)) {
            $out['header'] = $input['header'];
        }

        return $out;
    }

    /**
     * @return list<string>|null
     */
    private static function colors(string $group, mixed $key): ?array
    {
        if (! is_string($key)) {
            return null;
        }
        $colors = config("plus.{$group}.{$key}");

        return is_array($colors) && $colors !== [] ? array_values(array_map('strval', $colors)) : null;
    }

    /**
     * @return list<string>|null
     */
    private static function frame(mixed $key): ?array
    {
        if ($key === 'season') {
            $all = (array) config('plus.season_frames');
            $colors = $all[(now()->month - 1) % max(1, count($all))] ?? null;

            return is_array($colors) ? array_values(array_map('strval', $colors)) : null;
        }

        return self::colors('frames', $key);
    }
}
