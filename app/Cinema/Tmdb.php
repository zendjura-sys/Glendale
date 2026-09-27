<?php

namespace App\Cinema;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * TMDB (themoviedb.org) — джерело каталогу: описи українською, постери,
 * актори, сезони, трейлери. Ключ — в адмінці: API Key (v3) або API Read
 * Access Token (v4, довгий) — підходить будь-який.
 */
final class Tmdb
{
    public const API = 'https://api.themoviedb.org/3';

    public const IMAGES = 'https://image.tmdb.org/t/p/';

    public static function configured(): bool
    {
        return (bool) CinemaSettings::tmdbKey();
    }

    public static function image(?string $path, string $size = 'w500'): ?string
    {
        if (! $path) {
            return null;
        }

        return str_starts_with($path, 'http') ? $path : self::IMAGES.$size.$path;
    }

    /** @return array<string, mixed> */
    public static function get(string $path, array $params = []): array
    {
        $key = CinemaSettings::tmdbKey();
        if (! $key) {
            throw new RuntimeException('Ключ TMDB не налаштовано (Кінопортал → Налаштування).');
        }
        $request = Http::timeout(20)->connectTimeout(8)->acceptJson()->retry(2, 300, throw: false);
        // Довгий токен (v4 Read Access Token, JWT) — у заголовку; короткий v3-ключ — параметром.
        if (strlen($key) > 40) {
            $request = $request->withToken($key);
        } else {
            $params['api_key'] = $key;
        }
        $params['language'] ??= CinemaSettings::language();

        $response = $request->get(self::API.'/'.ltrim($path, '/'), $params);
        if (! $response->successful()) {
            throw new RuntimeException('TMDB: '.($response->json('status_message') ?: 'помилка '.$response->status()));
        }

        return (array) $response->json();
    }
}
