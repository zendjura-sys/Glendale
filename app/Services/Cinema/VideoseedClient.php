<?php

namespace App\Services\Cinema;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Videoseed (api.videoseed.tv/apiv2.php): фільми й серіали з озвучками, пошук за ID Кінопошуку, IMDb і TMDB.
 *
 * Плеєр — iframe на домені Videoseed; кожна озвучка має власне посилання (default_audio_id),
 * тож у нас вона стає окремим джерелом, як і в Kodik.
 */
class VideoseedClient
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function token(): ?string
    {
        return $this->settings->secret('videoseed_token') ?: config('services.videoseed.token');
    }

    public function configured(): bool
    {
        return filled($this->token());
    }

    public function test(): bool
    {
        try {
            return ($this->request(['list' => 'movie', 'items' => 1])['status'] ?? null) === 'success';
        } catch (CinemaException) {
            return false;
        }
    }

    /**
     * Один матеріал за зовнішнім ID (item=search) або список за назвою (list=movie|serial&q=).
     *
     * @param  array{title?: string|null, kinopoisk_id?: string|null, imdb_id?: string|null, tmdb_id?: string|null}  $criteria
     * @return list<array<string, mixed>>
     */
    public function search(array $criteria): array
    {
        $ids = array_filter([
            'kp' => $criteria['kinopoisk_id'] ?? null,
            'imdb' => $criteria['imdb_id'] ?? null,
            'tmdb' => isset($criteria['tmdb_id']) ? preg_replace('/^(movie|tv):/', '', (string) $criteria['tmdb_id']) : null,
        ], fn ($v) => filled($v));

        foreach ($ids as $param => $value) {
            $items = self::items($this->request(['item' => 'search', $param => $value]));
            if ($items !== []) {
                return array_map(self::candidate(...), $items);
            }
        }

        $title = trim((string) ($criteria['title'] ?? ''));
        if ($ids !== [] || $title === '') {
            return [];
        }

        $found = [];
        foreach (['movie', 'serial'] as $list) {
            foreach (self::items($this->request(['list' => $list, 'q' => $title, 'items' => 20])) as $item) {
                $found[] = self::candidate($item);
            }
        }

        return $found;
    }

    /**
     * Нові й оновлені матеріали, сторінками.
     *
     * @param  list<string>  $lists  movie | serial
     * @return \Generator<int, list<array<string, mixed>>>
     */
    public function updates(array $lists, int $pages): \Generator
    {
        foreach ($lists as $list) {
            for ($page = 1; $page <= $pages; $page++) {
                $json = $this->request(['list' => $list, 'sort_by' => 'post_date desc', 'from' => $page, 'items' => 50]);
                yield array_map(self::candidate(...), self::items($json));
                if (empty($json['next_page'])) {
                    break;
                }
            }
        }
    }

    /**
     * Сезони й серії серіалу: номер сезону → номери серій.
     *
     * @param  array{kinopoisk_id?: string|null, imdb_id?: string|null, tmdb_id?: string|null}  $criteria
     * @return array<int, list<int>>
     */
    public function episodes(array $criteria): array
    {
        $ids = array_filter([
            'kp' => $criteria['kinopoisk_id'] ?? null,
            'imdb' => $criteria['imdb_id'] ?? null,
            'tmdb' => isset($criteria['tmdb_id']) ? preg_replace('/^(movie|tv):/', '', (string) $criteria['tmdb_id']) : null,
        ], fn ($v) => filled($v));

        foreach ($ids as $param => $value) {
            foreach (self::items($this->request(['item' => 'search', $param => $value])) as $item) {
                $seasons = [];
                foreach (is_array($item['seasons'] ?? null) ? $item['seasons'] : [] as $season => $data) {
                    if (! is_numeric($season) || ! is_array($data['videos'] ?? null)) {
                        continue;
                    }
                    foreach (array_keys($data['videos']) as $episode) {
                        if (is_numeric($episode)) {
                            $seasons[(int) $season][(int) $episode] = (int) $episode;
                        }
                    }
                }
                if ($seasons !== []) {
                    return KodikClient::sorted($seasons);
                }
            }
        }

        return [];
    }

    /**
     * Свіжі фільми й серіали однією сторінкою (для ручного імпорту в адмінці).
     *
     * @return list<array<string, mixed>>
     */
    public function latest(int $page = 1): array
    {
        $out = [];
        foreach (['movie', 'serial'] as $list) {
            foreach (self::items($this->request(['list' => $list, 'sort_by' => 'post_date desc', 'from' => max(1, $page), 'items' => 30])) as $item) {
                $out[] = self::candidate($item);
            }
        }

        return $out;
    }

    /**
     * Перелік озвучок Videoseed (для фільтрів в адмінці).
     *
     * @return list<string>
     */
    public function voices(): array
    {
        $names = [];
        foreach (self::items($this->request(['list' => 'voice'])) as $voice) {
            $name = self::str($voice['name'] ?? $voice['title'] ?? null);
            if ($name !== null) {
                $names[] = $name;
            }
        }

        return array_values(array_unique($names));
    }

    /**
     * @param  array<string, scalar>  $params
     * @return array<string, mixed>
     */
    private function request(array $params): array
    {
        if (! $this->configured()) {
            throw new CinemaException('Videoseed не підключено: додайте токен в інтеграціях.', 422);
        }

        try {
            $response = Http::acceptJson()->timeout(15)->retry(2, 300, throw: false)
                ->get((string) config('services.videoseed.api_url', 'https://api.videoseed.tv/apiv2.php'), [...$params, 'token' => $this->token()]);
        } catch (ConnectionException) {
            throw new CinemaException('Videoseed не відповідає.');
        }

        $json = $response->json();
        if (in_array($response->status(), [401, 403], true) || (is_array($json) && ($json['status'] ?? null) === 'error' && str_contains(mb_strtolower((string) ($json['message'] ?? $json['error'] ?? '')), 'token'))) {
            throw new CinemaException('Videoseed відхилив токен. Перевірте його в інтеграціях.', 401);
        }
        if (! $response->successful() || ! is_array($json)) {
            throw new CinemaException('Videoseed тимчасово недоступний.');
        }

        return $json;
    }

    /**
     * data — або список, або один об’єкт (item=search).
     *
     * @param  array<string, mixed>  $json
     * @return list<array<string, mixed>>
     */
    private static function items(array $json): array
    {
        $data = $json['data'] ?? null;
        if (! is_array($data) || $data === []) {
            return [];
        }
        if (! array_is_list($data)) {
            $data = [$data];
        }

        $items = [];
        foreach ($data as $item) {
            if (is_array($item)) {
                $items[] = $item;
            }
        }

        return $items;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    public static function candidate(array $item): array
    {
        $id = (string) ($item['id'] ?? '');
        $serial = ($item['type'] ?? '') === 'serial';
        $tmdb = self::str($item['id_tmdb'] ?? null);
        $kp = self::str($item['id_kp'] ?? null);
        $imdb = self::str($item['id_imdb'] ?? null);

        return [
            'key' => $kp ? 'kp:'.$kp : ($imdb ? 'imdb:'.$imdb : 'vs:'.$id),
            'type' => $serial ? 'serial' : 'movie',
            'title' => (string) (self::str($item['name'] ?? null) ?? self::str($item['original_name'] ?? null) ?? ''),
            'title_original' => self::str($item['original_name'] ?? null),
            'year' => is_numeric($item['year'] ?? null) ? (int) $item['year'] : null,
            'description' => self::str($item['description'] ?? null),
            'poster_url' => self::url($item['poster'] ?? null),
            'backdrop_url' => null,
            'genres' => self::list($item['genre'] ?? null, 8),
            'countries' => self::list($item['country'] ?? null, 5),
            'duration' => self::minutes($item['time'] ?? null, $serial),
            'age_rating' => null,
            'rating_kp' => null,
            'rating_imdb' => null,
            'rating_shikimori' => null,
            'kinopoisk_id' => $kp,
            'imdb_id' => $imdb,
            'shikimori_id' => null,
            'tmdb_id' => $tmdb ? ($serial ? 'tv:' : 'movie:').$tmdb : null,
            'episodes_count' => is_numeric($item['total_videos'] ?? null) ? (int) $item['total_videos'] : null,
            'sources' => self::sources($item, $id),
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return list<array{provider: string, external_id: string, translation: string|null, translation_type: string|null, quality: string|null, link: string}>
     */
    private static function sources(array $item, string $id): array
    {
        $sources = [];
        $voices = is_array($item['translation_iframe'] ?? null) ? $item['translation_iframe'] : [];
        foreach ($voices as $name => $voice) {
            if (! is_array($voice) || ($link = self::url($voice['iframe'] ?? null)) === null) {
                continue;
            }
            $sources[] = [
                'provider' => 'videoseed',
                'external_id' => $id.':'.(self::str($voice['translations_id'] ?? null) ?? md5($link)),
                'translation' => self::str($voice['name'] ?? null) ?? (is_string($name) ? $name : null),
                'translation_type' => null,
                'quality' => null,
                'link' => $link,
            ];
        }

        if ($sources === [] && ($link = self::url($item['iframe'] ?? null)) !== null) {
            $sources[] = [
                'provider' => 'videoseed',
                'external_id' => $id !== '' ? $id : md5($link),
                'translation' => self::str($item['translation'] ?? null),
                'translation_type' => null,
                'quality' => null,
                'link' => $link,
            ];
        }

        return $sources;
    }

    private static function minutes(mixed $value, bool $serial): ?int
    {
        if ($serial || ! is_string($value) || ! preg_match('/^(\d+):(\d{2})$/', $value, $m)) {
            return null;
        }
        $total = (int) $m[1] * 60 + (int) $m[2];

        return $total > 0 ? $total : null;
    }

    /**
     * @return list<string>
     */
    private static function list(mixed $value, int $limit): array
    {
        if (! is_string($value)) {
            return [];
        }
        $parts = array_filter(array_map(fn (string $s) => mb_strtolower(trim($s)), explode(',', $value)), fn (string $s) => $s !== '' && $s !== 'сериалы' && $s !== 'фильмы');

        return array_slice(array_values(array_unique($parts)), 0, $limit);
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

        return str_starts_with($value, 'https://') ? $value : null;
    }
}
