<?php

namespace App\Services\Cinema\Metadata;

use App\Models\Movie;
use Illuminate\Http\Client\PendingRequest;

/**
 * The Movie Database: локалізовані (українські) назви й описи, якісні постери/фони, трейлери, рейтинг TMDB.
 * Приймає як API Key (v3), так і API Read Access Token (v4, починається з eyJ).
 */
class TmdbProvider extends MetadataProvider
{
    public function key(): string
    {
        return 'tmdb';
    }

    public function label(): string
    {
        return 'TMDB';
    }

    public function token(): ?string
    {
        return $this->settings->secret('tmdb_token') ?: config('services.tmdb.token');
    }

    public function language(): string
    {
        return (string) ($this->settings->get('tmdb_language') ?: 'uk-UA');
    }

    public function configured(): bool
    {
        return filled($this->token());
    }

    public function test(): bool
    {
        return $this->get('/configuration') !== null;
    }

    public function lookup(Movie $movie): ?array
    {
        [$kind, $id] = $this->resolve($movie);
        if (! $id) {
            return null;
        }

        $lang = $this->language();
        $short = substr($lang, 0, 2);
        $d = $this->get("/{$kind}/{$id}", [
            'language' => $lang,
            'append_to_response' => 'videos,external_ids,'.($kind === 'tv' ? 'content_ratings' : 'release_dates'),
            'include_video_language' => "{$short},en,null",
        ]);
        if (! $d) {
            return null;
        }

        $img = rtrim((string) config('services.tmdb.image_url'), '/');
        $title = self::str($d['title'] ?? $d['name'] ?? null, 200);
        $original = self::str($d['original_title'] ?? $d['original_name'] ?? null, 200);

        return array_filter([
            'tmdb_id' => "{$kind}:{$id}",
            'title' => $title,
            'title_localized' => $title !== null && $title !== $original,
            'title_original' => $original,
            'tagline' => self::str($d['tagline'] ?? null, 300),
            'description' => self::str($d['overview'] ?? null, 5000),
            'poster_url' => isset($d['poster_path']) ? $img.'/w500'.$d['poster_path'] : null,
            'backdrop_url' => isset($d['backdrop_path']) ? $img.'/w1280'.$d['backdrop_path'] : null,
            'genres' => collect($d['genres'] ?? [])->pluck('name')->filter()->map(fn ($g) => mb_strtolower((string) $g))->values()->all() ?: null,
            'duration' => (int) ($d['runtime'] ?? ($d['episode_run_time'][0] ?? 0)) ?: null,
            'year' => self::year($d['release_date'] ?? $d['first_air_date'] ?? null),
            'rating_tmdb' => self::rating($d['vote_average'] ?? null),
            'imdb_id' => self::str($d['imdb_id'] ?? $d['external_ids']['imdb_id'] ?? null),
            'episodes_count' => isset($d['number_of_episodes']) ? (int) $d['number_of_episodes'] : null,
            'age_rating' => $this->certification($d, $kind),
            'trailer_url' => $this->trailer($d['videos']['results'] ?? [], $short),
        ], fn ($v) => $v !== null && $v !== []);
    }

    /**
     * @return array{0: string, 1: string|null}
     */
    private function resolve(Movie $movie): array
    {
        if ($movie->tmdb_id && preg_match('/^(movie|tv):(\d+)$/', $movie->tmdb_id, $m)) {
            return [$m[1], $m[2]];
        }

        $kind = in_array($movie->type, ['serial', 'documentary'], true) || ($movie->episodes_count ?? 0) > 1 ? 'tv' : 'movie';

        if ($movie->imdb_id) {
            $found = $this->get('/find/'.$movie->imdb_id, ['external_source' => 'imdb_id']);
            foreach ([$kind, $kind === 'tv' ? 'movie' : 'tv'] as $k) {
                if ($id = $found[$k.'_results'][0]['id'] ?? null) {
                    return [$k, (string) $id];
                }
            }
        }

        $query = $movie->title_original ?: $movie->title;
        if (! $query) {
            return [$kind, null];
        }
        $found = $this->get('/search/'.$kind, array_filter([
            'query' => $query,
            $kind === 'tv' ? 'first_air_date_year' : 'year' => $movie->year,
            'language' => $this->language(),
        ]));
        $id = $found['results'][0]['id'] ?? null;

        return [$kind, $id ? (string) $id : null];
    }

    /**
     * @param  array<string, mixed>  $d
     */
    private function certification(array $d, string $kind): ?string
    {
        $rows = $kind === 'tv' ? ($d['content_ratings']['results'] ?? []) : ($d['release_dates']['results'] ?? []);
        foreach (['UA', 'RU', 'DE', 'US'] as $country) {
            foreach ($rows as $row) {
                if (($row['iso_3166_1'] ?? null) !== $country) {
                    continue;
                }
                $value = $kind === 'tv' ? ($row['rating'] ?? null) : collect($row['release_dates'] ?? [])->pluck('certification')->filter()->first();
                if ($value = self::str($value, 10)) {
                    return preg_match('/^\d+$/', $value) ? $value.'+' : $value;
                }
            }
        }

        return null;
    }

    /**
     * @param  list<array<string, mixed>>  $videos
     */
    private function trailer(array $videos, string $lang): ?string
    {
        $youtube = collect($videos)->where('site', 'YouTube')->filter(fn ($v) => filled($v['key'] ?? null));
        $best = $youtube->where('type', 'Trailer')->sortBy(fn ($v) => ($v['iso_639_1'] ?? '') === $lang ? 0 : 1)->first()
            ?? $youtube->where('type', 'Teaser')->first();

        return $best ? 'https://www.youtube-nocookie.com/embed/'.$best['key'] : null;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function get(string $path, array $query = []): ?array
    {
        return $this->fetch($this->client(), rtrim((string) config('services.tmdb.api_url'), '/').$path, $query + $this->authQuery());
    }

    private function client(): PendingRequest
    {
        $token = (string) $this->token();

        return str_starts_with($token, 'eyJ') ? $this->http()->withToken($token) : $this->http();
    }

    /**
     * @return array<string, string>
     */
    private function authQuery(): array
    {
        $token = (string) $this->token();

        return str_starts_with($token, 'eyJ') ? [] : ['api_key' => $token];
    }
}
