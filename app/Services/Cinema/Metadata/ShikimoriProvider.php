<?php

namespace App\Services\Cinema\Metadata;

use App\Models\Movie;

/**
 * Shikimori: метадані аніме (публічний API без ключа).
 */
class ShikimoriProvider extends MetadataProvider
{
    private const AGE = ['g' => '0+', 'pg' => '6+', 'pg_13' => '13+', 'r' => '17+', 'r_plus' => '18+', 'rx' => '18+'];

    public function key(): string
    {
        return 'shikimori';
    }

    public function label(): string
    {
        return 'Shikimori';
    }

    public function baseUrl(): string
    {
        return rtrim((string) ($this->settings->get('shikimori_url') ?: config('services.shikimori.url')), '/');
    }

    public function configured(): bool
    {
        return (bool) $this->settings->get('shikimori_enabled', true);
    }

    public function test(): bool
    {
        return $this->fetch($this->http(), $this->baseUrl().'/api/animes/1') !== null;
    }

    public function lookup(Movie $movie): ?array
    {
        $id = $movie->shikimori_id;
        if (! $id) {
            if ($movie->type !== 'anime') {
                return null;
            }
            $found = $this->fetch($this->http(), $this->baseUrl().'/api/animes', [
                'search' => $movie->title_original ?: $movie->title,
                'limit' => 1,
            ]);
            $id = null;
            if (is_array($found)) {
                foreach ($found as $row) {
                    if (is_array($row) && isset($row['id']) && is_scalar($row['id'])) {
                        $id = (string) $row['id'];
                    }
                    break;
                }
            }
        }
        if (! $id) {
            return null;
        }

        $a = $this->fetch($this->http(), $this->baseUrl().'/api/animes/'.$id);
        if (! $a) {
            return null;
        }

        $image = self::str($a['image']['original'] ?? null);
        if ($image && str_starts_with($image, '/')) {
            $image = $this->baseUrl().$image;
        }
        $description = self::str($a['description'] ?? null);
        if ($description) {
            $description = trim((string) preg_replace(['/\[\[([^\]]+)\]\]/u', '/\[[^\]]+\]/u', '/\s{3,}/u'], ['$1', '', "\n\n"], $description));
        }

        $genres = self::genreNames($a['genres'] ?? null);

        return array_filter([
            'shikimori_id' => (string) $id,
            'title' => self::str($a['russian'] ?? null, 200),
            'title_original' => self::str($a['name'] ?? null, 200),
            'description' => $description ? mb_substr($description, 0, 5000) : null,
            'poster_url' => $image && ! str_contains($image, 'missing') ? $image : null,
            'genres' => $genres !== [] ? $genres : null,
            'rating_shikimori' => self::rating($a['score'] ?? null),
            'episodes_count' => (int) ($a['episodes'] ?: ($a['episodes_aired'] ?? 0)) ?: null,
            'duration' => (int) ($a['duration'] ?? 0) ?: null,
            'age_rating' => self::AGE[$a['rating'] ?? ''] ?? null,
            'year' => self::year($a['aired_on'] ?? null),
        ], fn ($v) => $v !== null);
    }

    /**
     * @return list<string>
     */
    private static function genreNames(mixed $genres): array
    {
        if (! is_array($genres)) {
            return [];
        }

        $names = [];
        foreach ($genres as $genre) {
            if (! is_array($genre)) {
                continue;
            }
            $name = $genre['russian'] ?? $genre['name'] ?? '';
            if (! is_scalar($name)) {
                continue;
            }
            $name = mb_strtolower(trim((string) $name));
            if ($name !== '') {
                $names[] = $name;
            }
        }

        return $names;
    }
}
