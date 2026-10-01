<?php

namespace App\Services\Cinema\Metadata;

use App\Models\Movie;
use App\Services\Cinema\CinemaException;

/**
 * OMDb API — дані та рейтинг IMDb (у IMDb немає публічного API).
 */
class OmdbProvider extends MetadataProvider
{
    public function key(): string
    {
        return 'omdb';
    }

    public function label(): string
    {
        return 'IMDb (OMDb)';
    }

    public function apiKey(): ?string
    {
        return $this->settings->secret('omdb_key') ?: config('services.omdb.key');
    }

    public function configured(): bool
    {
        return filled($this->apiKey());
    }

    public function test(): bool
    {
        return ($this->query(['i' => 'tt0111161'])['Response'] ?? null) === 'True';
    }

    public function lookup(Movie $movie): ?array
    {
        $params = $movie->imdb_id
            ? ['i' => $movie->imdb_id]
            : array_filter(['t' => $movie->title_original, 'y' => $movie->year]);
        if (! isset($params['i']) && ! isset($params['t'])) {
            return null;
        }

        $d = $this->query([...$params, 'plot' => 'full']);
        if (! $d || ($d['Response'] ?? null) !== 'True') {
            return null;
        }

        return array_filter([
            'imdb_id' => self::str($d['imdbID'] ?? null),
            'title_original' => self::str($d['Title'] ?? null, 200),
            'rating_imdb' => self::rating($d['imdbRating'] ?? null),
            'poster_url' => preg_match('#^https?://#', (string) ($d['Poster'] ?? '')) ? $d['Poster'] : null,
            'duration' => preg_match('/(\d+)/', (string) ($d['Runtime'] ?? ''), $m) ? (int) $m[1] : null,
            'year' => self::year($d['Year'] ?? null),
            'age_rating' => self::str($d['Rated'] ?? null, 10),
        ], fn ($v) => $v !== null);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null
     */
    private function query(array $params): ?array
    {
        $json = $this->fetch($this->http(), rtrim((string) config('services.omdb.api_url'), '/').'/', [...$params, 'apikey' => $this->apiKey()]);
        if (is_array($json) && str_contains(mb_strtolower((string) ($json['Error'] ?? '')), 'api key')) {
            throw new CinemaException('OMDb відхилив ключ. Перевірте його в інтеграціях.', 401);
        }

        return $json;
    }
}
