<?php

namespace App\Services\Cinema;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * API FlixCDN. Публічної документації немає, тому адреси запитів беруться з кабінету FlixCDN як шаблони:
 *   пошук     — {token}, {kinopoisk_id}, {imdb_id}, {title};
 *   оновлення — {token}, {page}.
 * Відповідь розбирається гнучко: список у results/data/items/… та типові назви полів балансерів
 * (kinopoisk_id|kp_id, iframe_url|iframe_src|iframe|link…).
 *
 * Озвучки — окремими плеєрами: якщо API віддає один запис зі списком translations (з ID), кожна
 * озвучка стає окремим джерелом із посиланням «плеєр + ?{параметр}={ID озвучки}». Назву параметра
 * задає адміністратор (flixcdn_translation_param, типово translation); порожньо — один плеєр «Усі озвучки».
 */
class FlixcdnClient
{
    private const LIST_KEYS = ['results', 'data', 'items', 'list', 'movies', 'films', 'videos'];

    public const TRANSLATION_PARAM = 'translation';

    private const LINK_KEYS = ['iframe_url', 'iframe_src', 'iframe', 'player_url', 'player', 'embed_url', 'embed', 'link', 'url'];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly FlixcdnPlayer $player,
    ) {}

    public function searchTemplate(): ?string
    {
        return $this->settings->get('flixcdn_api_search') ?: config('services.flixcdn.api_search');
    }

    public function updatesTemplate(): ?string
    {
        return $this->settings->get('flixcdn_api_updates') ?: config('services.flixcdn.api_updates');
    }

    /** Параметр адреси плеєра, що вибирає озвучку (порожньо — не розбивати на окремі плеєри). */
    public function translationParam(): string
    {
        $value = trim((string) $this->settings->get('flixcdn_translation_param', ''));

        return match ($value) {
            '' => self::TRANSLATION_PARAM,
            '-' => '',
            default => $value,
        };
    }

    public function configured(): bool
    {
        return filled($this->searchTemplate()) || filled($this->updatesTemplate());
    }

    /**
     * @param  array{title?: string|null, kinopoisk_id?: string|null, imdb_id?: string|null}  $criteria
     * @return list<array<string, mixed>>
     */
    public function search(array $criteria): array
    {
        $template = $this->searchTemplate();
        if (! $template) {
            throw new CinemaException('Адресу пошуку Плеєра 3 не налаштовано.', 503);
        }

        $values = [
            '{kinopoisk_id}' => $criteria['kinopoisk_id'] ?? null,
            '{imdb_id}' => $criteria['imdb_id'] ?? null,
            '{title}' => $criteria['title'] ?? null,
        ];
        $needed = array_filter($values, fn ($v, $k) => str_contains($template, $k), ARRAY_FILTER_USE_BOTH);
        if ($needed === [] || collect($needed)->every(fn ($v) => blank($v))) {
            return [];
        }

        $url = $template;
        foreach ($values as $placeholder => $value) {
            $url = $this->strip($url, $placeholder, $value);
        }

        return self::group($this->request($url), $this->translationParam());
    }

    /**
     * @return array{candidates: list<array<string, mixed>>, has_more: bool}
     */
    public function updates(int $page = 1): array
    {
        $template = $this->updatesTemplate();
        if (! $template) {
            throw new CinemaException('Адресу оновлень Плеєра 3 не налаштовано.', 503);
        }

        $items = $this->request(str_replace('{page}', (string) max($page, 1), $template));

        return ['candidates' => self::group($items, $this->translationParam()), 'has_more' => str_contains($template, '{page}') && $items !== []];
    }

    public function test(): bool
    {
        try {
            if ($this->updatesTemplate()) {
                $this->updates();
            } else {
                $this->search(['kinopoisk_id' => '301', 'imdb_id' => 'tt0133093', 'title' => 'Матрица']);
            }

            return true;
        } catch (CinemaException) {
            return false;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    public static function group(array $items, string $param = self::TRANSLATION_PARAM): array
    {
        $candidates = [];

        foreach ($items as $item) {
            $link = self::link($item);
            if (! $link) {
                continue;
            }

            $kp = self::str(self::pick($item, ['kinopoisk_id', 'kp_id', 'kinopoisk', 'kp', 'id_kp']));
            $imdb = self::str(self::pick($item, ['imdb_id', 'imdb', 'id_imdb']));
            $title = self::str(self::pick($item, ['title_ru', 'ru_title', 'name_ru', 'title', 'name']));
            $year = self::pick($item, ['year', 'released', 'release_year']);
            $key = match (true) {
                $kp !== null => 'kp:'.$kp,
                $imdb !== null => 'imdb:'.$imdb,
                default => 'title:'.Str::slug(($title ?? '').'-'.($year ?? '')),
            };

            $candidates[$key] ??= [
                'key' => $key,
                'type' => self::type((string) self::pick($item, ['type', 'content_type', 'category'])),
                'title' => (string) ($title ?? ''),
                'title_original' => self::str(self::pick($item, ['title_orig', 'orig_title', 'original_title', 'title_en', 'en_title', 'name_en', 'name_original'])),
                'year' => is_numeric($year) || is_string($year) ? (preg_match('/(\d{4})/', (string) $year, $m) ? (int) $m[1] : null) : null,
                'description' => self::str(self::pick($item, ['description', 'overview', 'plot'])),
                'poster_url' => self::url(self::pick($item, ['poster', 'poster_url', 'cover', 'image'])),
                'backdrop_url' => self::url(self::pick($item, ['backdrop', 'backdrop_url', 'background'])),
                'genres' => array_map(mb_strtolower(...), self::names(self::pick($item, ['genres', 'genre']))),
                'countries' => self::names(self::pick($item, ['countries', 'country'])),
                'duration' => null,
                'age_rating' => null,
                'rating_kp' => self::rating(self::pick($item, ['kinopoisk_rating', 'rating_kp', 'kp_rating'])),
                'rating_imdb' => self::rating(self::pick($item, ['imdb_rating', 'rating_imdb'])),
                'rating_shikimori' => null,
                'kinopoisk_id' => $kp,
                'imdb_id' => $imdb,
                'shikimori_id' => self::str(self::pick($item, ['shikimori_id', 'shiki_id'])),
                'episodes_count' => null,
                'sources' => [],
            ];

            $translation = self::pick($item, ['translation', 'voice', 'translator']);
            if (is_array($translation)) {
                $translation = $translation['title'] ?? $translation['name'] ?? null;
            }
            $id = Str::limit((string) (self::str(self::pick($item, ['id', 'uid', 'token'])) ?? md5($link)), 80, '');
            $quality = self::str(self::pick($item, ['quality', 'source_quality', 'max_quality']));
            $voices = self::str($translation) === null && $param !== '' ? self::voices(self::pick($item, ['translations', 'voices'])) : [];

            if ($voices !== []) {
                // Окремий плеєр на кожну озвучку.
                foreach ($voices as $voice) {
                    $candidates[$key]['sources'][] = [
                        'provider' => 'flixcdn',
                        'external_id' => Str::limit($id.':'.$voice['id'], 100, ''),
                        'translation' => Str::limit($voice['title'], 150, ''),
                        'translation_type' => $voice['type'],
                        'quality' => $voice['quality'] ?? $quality,
                        'link' => self::withParam($link, $param, $voice['id']),
                    ];
                }

                continue;
            }

            $translations = self::names(self::pick($item, ['translations', 'voices']));
            $candidates[$key]['sources'][] = [
                'provider' => 'flixcdn',
                'external_id' => $id,
                'translation' => Str::limit((string) (self::str($translation) ?? ($translations ? implode(', ', array_slice($translations, 0, 4)) : 'Усі озвучки')), 150, ''),
                'translation_type' => null,
                'quality' => $quality,
                'link' => $link,
            ];
        }

        return array_values($candidates);
    }

    /**
     * Озвучки з ID: [{id, title}], {"id": "title"} або [{id, name, type, quality}].
     *
     * @return list<array{id: string, title: string, type: string|null, quality: string|null}>
     */
    private static function voices(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $k => $v) {
            if (is_array($v)) {
                $id = self::str($v['id'] ?? $v['translation_id'] ?? $v['uid'] ?? null);
                $title = self::str($v['title'] ?? $v['name'] ?? $v['translation'] ?? null);
                $type = self::str($v['type'] ?? null);
                $quality = self::str($v['quality'] ?? null);
            } else {
                // {"610": "AniLibria"} — ключ є ID; у звичайному списку рядків ID немає.
                $id = is_string($k) || ! array_is_list($value) ? self::str($k) : null;
                $title = self::str($v);
                $type = null;
                $quality = null;
            }
            if ($id === null || $title === null || isset($out[$id])) {
                continue;
            }
            $out[$id] = [
                'id' => $id,
                'title' => $title,
                'type' => match (true) {
                    $type === null => null,
                    str_contains(mb_strtolower($type), 'sub') || str_contains(mb_strtolower($type), 'суб') => 'subtitles',
                    default => 'voice',
                },
                'quality' => $quality,
            ];
        }

        // Одна озвучка — розбивати нема чого, але назву беремо з неї.
        return count($out) > 1 ? array_values($out) : [];
    }

    /** Додає (або замінює) параметр запиту в адресі плеєра. */
    private static function withParam(string $link, string $param, string $value): string
    {
        [$base, $fragment] = array_pad(explode('#', $link, 2), 2, null);
        $parts = parse_url($base);
        $query = [];
        parse_str($parts['query'] ?? '', $query);
        $query[$param] = $value;
        $path = strtok($base, '?');

        return Str::limit($path.'?'.http_build_query($query).($fragment !== null ? '#'.$fragment : ''), 500, '');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function request(string $url): array
    {
        if (str_contains($url, '{token}')) {
            $url = str_replace('{token}', rawurlencode((string) $this->player->token()), $url);
        }

        try {
            $response = Http::acceptJson()->timeout(20)->get($url);
        } catch (ConnectionException) {
            throw new CinemaException('Плеєр 3 не відповідає. Спробуйте пізніше.');
        }

        $json = $response->json();
        if (in_array($response->status(), [401, 403], true)) {
            throw new CinemaException('Плеєр 3 відхилив токен. Перевірте налаштування інтеграції.', 401);
        }
        if ($response->status() === 404) {
            return [];
        }
        if (! $response->successful() || ! is_array($json)) {
            throw new CinemaException('Плеєр 3 тимчасово недоступний.');
        }
        if (isset($json['error']) && is_string($json['error'])) {
            throw new CinemaException('Плеєр 3: '.Str::limit($json['error'], 120));
        }

        return self::extractList($json);
    }

    /**
     * @param  array<mixed>  $json
     * @return list<array<string, mixed>>
     */
    private static function extractList(array $json, int $depth = 0): array
    {
        if (Arr::isList($json)) {
            return array_values(array_filter($json, 'is_array'));
        }
        if (self::link($json)) {
            return [$json];
        }
        if ($depth < 2) {
            foreach (self::LIST_KEYS as $key) {
                if (isset($json[$key]) && is_array($json[$key])) {
                    return self::extractList($json[$key], $depth + 1);
                }
            }
        }

        return [];
    }

    private function strip(string $url, string $placeholder, mixed $value): string
    {
        if (! str_contains($url, $placeholder)) {
            return $url;
        }
        if (blank($value)) {
            // Прибираємо параметр запиту з порожнім значенням, напр. &imdb_id={imdb_id}.
            return (string) preg_replace('/[?&][^=&?]+='.preg_quote($placeholder, '/').'/', '', $url);
        }

        return str_replace($placeholder, rawurlencode((string) $value), $url);
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private static function link(array $item): ?string
    {
        foreach (self::LINK_KEYS as $key) {
            $value = $item[$key] ?? null;
            if (is_string($value) && preg_match('#^(https?:)?//#', $value)) {
                return Str::limit(str_starts_with($value, '//') ? 'https:'.$value : $value, 500, '');
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  list<string>  $keys
     */
    private static function pick(array $item, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (isset($item[$key]) && $item[$key] !== '') {
                return $item[$key];
            }
        }

        return null;
    }

    private static function type(string $raw): string
    {
        $raw = mb_strtolower($raw);

        return match (true) {
            str_contains($raw, 'anime') => 'anime',
            str_contains($raw, 'cartoon'), str_contains($raw, 'мульт') => 'cartoon',
            str_contains($raw, 'doc') => 'documentary',
            str_contains($raw, 'serial'), str_contains($raw, 'series'), str_contains($raw, 'tv'), str_contains($raw, 'сериал') => 'serial',
            default => 'movie',
        };
    }

    /**
     * @return list<string>
     */
    private static function names(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/\s*,\s*/u', $value) ?: [];
        }
        if (! is_array($value)) {
            return [];
        }

        return array_values(collect($value)
            ->map(fn ($v) => is_array($v) ? ($v['title'] ?? $v['name'] ?? null) : $v)
            ->filter(fn ($v) => is_scalar($v) && trim((string) $v) !== '')
            ->map(fn ($v) => trim((string) $v))
            ->unique()->take(8)->all());
    }

    private static function str(mixed $value): ?string
    {
        return is_scalar($value) && trim((string) $value) !== '' ? trim((string) $value) : null;
    }

    private static function url(mixed $value): ?string
    {
        $value = self::str($value);
        if ($value && str_starts_with($value, '//')) {
            $value = 'https:'.$value;
        }

        return $value && preg_match('#^https?://#', $value) ? Str::limit($value, 500, '') : null;
    }

    private static function rating(mixed $value): ?float
    {
        return is_numeric($value) && (float) $value > 0 ? round((float) $value, 1) : null;
    }
}
