<?php

namespace App\Services\Cinema\Metadata;

use App\Models\Movie;

/**
 * Kinopoisk API Unofficial (kinopoiskapiunofficial.tech) — рейтинг КіноПошуку, слоган, обкладинки.
 */
class KinopoiskProvider extends MetadataProvider
{
    public function key(): string
    {
        return 'kinopoisk';
    }

    public function label(): string
    {
        return 'КіноПошук';
    }

    public function apiKey(): ?string
    {
        return $this->settings->secret('kinopoisk_key') ?: config('services.kinopoisk.key');
    }

    public function configured(): bool
    {
        return filled($this->apiKey());
    }

    public function test(): bool
    {
        return $this->film('301') !== null;
    }

    public function lookup(Movie $movie): ?array
    {
        if (! $movie->kinopoisk_id) {
            return null;
        }

        $d = $this->film($movie->kinopoisk_id);
        if (! $d) {
            return null;
        }

        return array_filter([
            'title' => self::str($d['nameRu'] ?? null, 200),
            'title_original' => self::str($d['nameOriginal'] ?? $d['nameEn'] ?? null, 200),
            'tagline' => self::str($d['slogan'] ?? null, 300),
            'description' => self::str($d['description'] ?? null, 5000),
            'poster_url' => self::str($d['posterUrl'] ?? null, 500),
            'backdrop_url' => self::str($d['coverUrl'] ?? null, 500),
            'genres' => collect($d['genres'] ?? [])->pluck('genre')->filter()->values()->all() ?: null,
            'countries' => collect($d['countries'] ?? [])->pluck('country')->filter()->values()->all() ?: null,
            'duration' => (int) ($d['filmLength'] ?? 0) ?: null,
            'rating_kp' => self::rating($d['ratingKinopoisk'] ?? null),
            'rating_imdb' => self::rating($d['ratingImdb'] ?? null),
            'imdb_id' => self::str($d['imdbId'] ?? null),
            'age_rating' => preg_match('/(\d+)/', (string) ($d['ratingAgeLimits'] ?? ''), $m) ? $m[1].'+' : null,
            'year' => self::year($d['year'] ?? null),
        ], fn ($v) => $v !== null && $v !== []);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function film(string $id): ?array
    {
        return $this->fetch(
            $this->http()->withHeaders(['X-API-KEY' => (string) $this->apiKey()]),
            rtrim((string) config('services.kinopoisk.api_url'), '/').'/api/v2.2/films/'.rawurlencode($id),
        );
    }
}
