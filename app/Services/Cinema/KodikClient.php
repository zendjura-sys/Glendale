<?php

namespace App\Services\Cinema;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Kodik API (kodik-api.com): пошук матеріалів із метаданими та посиланнями на плеєр.
 * Кожна озвучка в Kodik — окремий результат, тож результати групуються в «кандидатів» за зовнішніми ID (Shikimori/IMDb тощо).
 */
class KodikClient
{
    private const TYPES = [
        'foreign-movie' => 'movie',
        'russian-movie' => 'movie',
        'foreign-serial' => 'serial',
        'russian-serial' => 'serial',
        'multi-part-film' => 'serial',
        'anime' => 'anime',
        'anime-serial' => 'anime',
        'cartoon-serial' => 'cartoon',
        'foreign-cartoon' => 'cartoon',
        'russian-cartoon' => 'cartoon',
        'soviet-cartoon' => 'cartoon',
        'documentary-serial' => 'documentary',
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    public function token(): ?string
    {
        return $this->settings->secret('kodik_token') ?: config('services.kodik.token');
    }

    public function configured(): bool
    {
        return filled($this->token());
    }

    /**
     * @param  array{title?: string, kinopoisk_id?: string, imdb_id?: string, shikimori_id?: string, types?: string}  $criteria
     * @return list<array<string, mixed>>
     */
    public function search(array $criteria): array
    {
        $params = array_filter($criteria, fn ($v) => filled($v));
        if ($params === []) {
            return [];
        }

        return self::group($this->request('/search', [...$params, 'limit' => 100, 'with_material_data' => 'true'])['results'] ?? []);
    }

    /**
     * Сезони й серії (за всіма озвучками): номер сезону → номери серій.
     *
     * @param  array<string, string|null>  $criteria
     * @return array<int, list<int>>
     */
    public function episodes(array $criteria): array
    {
        $params = array_filter($criteria, fn ($v) => filled($v));
        if ($params === []) {
            return [];
        }

        $seasons = [];
        foreach ($this->request('/search', [...$params, 'limit' => 100, 'with_episodes' => 'true'])['results'] ?? [] as $item) {
            if (! is_array($item) || ! is_array($item['seasons'] ?? null)) {
                continue;
            }
            foreach ($item['seasons'] as $season => $data) {
                if (! is_numeric($season) || ! is_array($data['episodes'] ?? null)) {
                    continue;
                }
                foreach (array_keys($data['episodes']) as $episode) {
                    if (is_numeric($episode)) {
                        $seasons[(int) $season][(int) $episode] = (int) $episode;
                    }
                }
            }
        }

        return self::sorted($seasons);
    }

    /**
     * @param  array<int, array<int, int>>  $seasons
     * @return array<int, list<int>>
     */
    public static function sorted(array $seasons): array
    {
        ksort($seasons);
        $out = [];
        foreach ($seasons as $season => $episodes) {
            sort($episodes);
            $out[$season] = $episodes;
        }

        return $out;
    }

    /**
     * Свіжі оновлення каталогу Kodik.
     *
     * @return list<array<string, mixed>>
     */
    public function latest(?string $types = null, int $limit = 100): array
    {
        return self::group($this->request('/list', array_filter([
            'limit' => min(max($limit, 1), 100),
            'sort' => 'updated_at',
            'order' => 'desc',
            'types' => $types,
            'has_field' => 'kinopoisk_id',
            'with_material_data' => 'true',
        ]))['results'] ?? []);
    }

    /**
     * Оновлення каталогу Kodik сторінками по 100 (через next_page).
     *
     * @return \Generator<int, list<array<string, mixed>>>
     */
    public function updates(?string $types, int $pages): \Generator
    {
        $next = null;
        for ($i = 0; $i < $pages; $i++) {
            $json = $next
                ? $this->request($next, [])
                : $this->request('/list', array_filter([
                    'limit' => 100,
                    'sort' => 'updated_at',
                    'order' => 'desc',
                    'types' => $types,
                    'with_material_data' => 'true',
                ]));

            yield self::group($json['results'] ?? []);

            $next = is_string($json['next_page'] ?? null) && self::trustedHost($json['next_page']) ? $json['next_page'] : null;
            if (! $next) {
                return;
            }
        }
    }

    public function test(): bool
    {
        try {
            $this->request('/list', ['limit' => 1]);

            return true;
        } catch (CinemaException) {
            return false;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $results
     * @return list<array<string, mixed>>
     */
    public static function group(array $results): array
    {
        $candidates = [];

        foreach ($results as $item) {
            if (empty($item['link'])) {
                continue;
            }

            $key = self::keyFor($item);
            $candidates[$key] ??= self::candidate($item, $key);
            $candidates[$key]['sources'][] = self::source($item);
            $candidates[$key]['episodes_count'] = max((int) $candidates[$key]['episodes_count'], (int) ($item['episodes_count'] ?? $item['last_episode'] ?? 0)) ?: null;
        }

        return array_values($candidates);
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private static function keyFor(array $item): string
    {
        return match (true) {
            filled($item['kinopoisk_id'] ?? null) => 'kp:'.$item['kinopoisk_id'],
            filled($item['shikimori_id'] ?? null) => 'shiki:'.$item['shikimori_id'],
            filled($item['imdb_id'] ?? null) => 'imdb:'.$item['imdb_id'],
            default => 'title:'.Str::slug(($item['title'] ?? '').'-'.($item['year'] ?? '')),
        };
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private static function candidate(array $item, string $key): array
    {
        $m = is_array($item['material_data'] ?? null) ? $item['material_data'] : [];
        $type = self::TYPES[$item['type'] ?? ''] ?? 'movie';
        $anime = $type === 'anime';
        $screenshots = array_values(array_filter([...($m['screenshots'] ?? []), ...($item['screenshots'] ?? [])], 'is_string'));

        return [
            'key' => $key,
            'type' => $type,
            'title' => (string) ($m['title'] ?? $item['title'] ?? ''),
            'title_original' => self::str($m['title_en'] ?? $item['title_orig'] ?? null),
            'year' => isset($item['year']) ? (int) $item['year'] : (isset($m['year']) ? (int) $m['year'] : null),
            'description' => self::str($anime ? ($m['anime_description'] ?? $m['description'] ?? null) : ($m['description'] ?? $m['anime_description'] ?? null)),
            'poster_url' => self::url($anime ? ($m['anime_poster_url'] ?? $m['poster_url'] ?? null) : ($m['poster_url'] ?? $m['anime_poster_url'] ?? null)),
            'backdrop_url' => self::url($screenshots[0] ?? null),
            'genres' => array_values(array_slice(array_unique(array_map('strval', $m['all_genres'] ?? $m['genres'] ?? $m['anime_genres'] ?? [])), 0, 8)),
            'countries' => array_values(array_slice(array_map('strval', $m['countries'] ?? []), 0, 5)),
            'duration' => isset($m['duration']) ? (int) $m['duration'] : null,
            'age_rating' => isset($m['minimal_age']) ? $m['minimal_age'].'+' : self::str($m['rating_mpaa'] ?? null),
            'rating_kp' => isset($m['kinopoisk_rating']) ? round((float) $m['kinopoisk_rating'], 1) : null,
            'rating_imdb' => isset($m['imdb_rating']) ? round((float) $m['imdb_rating'], 1) : null,
            'rating_shikimori' => isset($m['shikimori_rating']) ? round((float) $m['shikimori_rating'], 1) : null,
            'kinopoisk_id' => self::str($item['kinopoisk_id'] ?? null),
            'imdb_id' => self::str($item['imdb_id'] ?? null),
            'shikimori_id' => self::str($item['shikimori_id'] ?? null),
            'episodes_count' => null,
            'sources' => [],
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{provider: string, external_id: string, translation: string|null, translation_type: string|null, quality: string|null, link: string}
     */
    private static function source(array $item): array
    {
        $link = (string) $item['link'];

        return [
            'provider' => 'kodik',
            'external_id' => (string) ($item['id'] ?? md5($link)),
            'translation' => self::str($item['translation']['title'] ?? null),
            'translation_type' => self::str($item['translation']['type'] ?? null),
            'quality' => self::str($item['quality'] ?? null),
            'link' => str_starts_with($link, '//') ? 'https:'.$link : $link,
        ];
    }

    private static function trustedHost(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) && ($host === parse_url((string) config('services.kodik.api_url'), PHP_URL_HOST) || str_contains($host, 'kodik'));
    }

    private static function str(mixed $value): ?string
    {
        return is_scalar($value) && trim((string) $value) !== '' ? trim((string) $value) : null;
    }

    private static function url(mixed $value): ?string
    {
        $value = self::str($value);
        if ($value === null) {
            return null;
        }
        if (str_starts_with($value, '//')) {
            $value = 'https:'.$value;
        }

        return preg_match('#^https?://#', $value) === 1 ? Str::limit($value, 500, '') : null;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function request(string $path, array $params): array
    {
        if (! $this->configured()) {
            throw new CinemaException('Kodik не налаштовано адміністратором.', 503);
        }

        $url = preg_match('#^https?://#', $path) ? $path : rtrim((string) config('services.kodik.api_url'), '/').$path;
        if (! str_contains($url, 'token=')) {
            $params['token'] = $this->token();
        }
        // Параметри дописуємо в саму адресу: next_page від Kodik уже має рядок запиту (token, next),
        // а передача окремого масиву query його повністю замінює — друга сторінка йшла без токена.
        if ($params !== []) {
            $url .= (str_contains($url, '?') ? '&' : '?').http_build_query($params);
        }

        try {
            $response = Http::acceptJson()->timeout(20)->get($url);
        } catch (ConnectionException) {
            throw new CinemaException('Kodik не відповідає. Спробуйте пізніше.');
        }

        $json = $response->json();
        if (! $response->successful() || ! is_array($json) || isset($json['error'])) {
            $error = is_array($json) ? (string) ($json['error'] ?? '') : '';
            throw new CinemaException(
                str_contains(mb_strtolower($error), 'токен') || in_array($response->status(), [401, 403], true)
                    ? 'Kodik відхилив токен. Перевірте його в налаштуваннях інтеграції.'
                    : 'Kodik тимчасово недоступний.',
                $response->status() >= 400 ? $response->status() : 502,
            );
        }

        return $json;
    }
}
