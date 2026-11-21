<?php

namespace App\Services\Music;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * База релізів Discogs (особистий токен у Адмінка → Інтеграції): рік, лейбл, жанри й стилі, країна,
 * номер доріжки, обкладинка релізу, фото й опис виконавця. Ліміт сервісу — 60 запитів на хвилину,
 * тому запити йдуть через спільний Throttle. Відповіді (і «не знайдено») кешуються, збій — null.
 */
class Discogs
{
    public const USER_AGENT = 'GameCon/1.0 +https://gamecon.online';

    public function __construct(private readonly SiteSettings $settings) {}

    public function token(): ?string
    {
        return $this->settings->secret('discogs_token') ?: config('services.discogs.token');
    }

    public function configured(): bool
    {
        return filled($this->token()) && (bool) config('services.music_metadata.enabled', true);
    }

    /**
     * Реліз із доріжкою: спершу пошук за виконавцем і назвою доріжки, у знайденому релізі — доріжка
     * з тією самою назвою й тривалістю ±5 с. Найраніший такий реліз.
     *
     * @return array{id: int, album: string, year: int|null, label: string|null, country: string|null, genres: list<string>, track_no: int|null, cover: string|null, cover_width: int|null, artist_id: int|null}|null
     */
    public function findRelease(string $artist, string $title, ?string $album = null, ?int $duration = null): ?array
    {
        $search = $this->get('database/search', array_filter([
            'type' => 'release', 'artist' => $artist, 'track' => $title, 'release_title' => $album, 'per_page' => 10,
        ]));
        $results = array_values(array_filter((array) ($search['results'] ?? []), 'is_array'));
        usort($results, fn ($a, $b) => ((int) ($a['year'] ?? 0) ?: 9999) <=> ((int) ($b['year'] ?? 0) ?: 9999));

        foreach (array_slice($results, 0, 3) as $result) {
            $release = isset($result['id']) ? $this->get('releases/'.(int) $result['id'], []) : null;
            if (! is_array($release) || ! MetaMatch::sameArtist(self::artistName($release), $artist)) {
                continue;
            }
            $trackNo = null;
            $matched = false;
            foreach ((array) ($release['tracklist'] ?? []) as $i => $track) {
                if (! is_array($track) || ($track['type_'] ?? 'track') !== 'track' || ! MetaMatch::sameTitle((string) ($track['title'] ?? ''), $title)) {
                    continue;
                }
                if (! MetaMatch::durationOk(self::seconds((string) ($track['duration'] ?? '')), $duration)) {
                    continue;
                }
                $matched = true;
                // Позиція буває «A1», «2-3» — номер беремо лише з чисел, інакше — порядок у списку.
                $position = (string) ($track['position'] ?? '');
                $trackNo = ctype_digit($position) ? (int) $position : (int) $i + 1;
                break;
            }
            if (! $matched) {
                continue;
            }
            $image = collect((array) ($release['images'] ?? []))->first(fn ($img) => is_array($img) && ($img['type'] ?? '') === 'primary')
                ?? ($release['images'][0] ?? null);

            return [
                'id' => (int) $release['id'],
                'album' => (string) ($release['title'] ?? ''),
                'year' => (int) ($release['year'] ?? 0) ?: null,
                'label' => $release['labels'][0]['name'] ?? null,
                'country' => $release['country'] ?? null,
                'genres' => array_values(array_unique(array_map(fn ($g) => MusicBrainz::genreName((string) $g), [...(array) ($release['styles'] ?? []), ...(array) ($release['genres'] ?? [])]))),
                'track_no' => $trackNo > 0 && $trackNo < 1000 ? $trackNo : null,
                'cover' => is_array($image) && filled($image['uri'] ?? null) ? (string) $image['uri'] : null,
                'cover_width' => is_array($image) ? ((int) ($image['width'] ?? 0) ?: null) : null,
                'artist_id' => (int) ($release['artists'][0]['id'] ?? 0) ?: null,
            ];
        }

        return null;
    }

    /**
     * Виконавець за ID або точним ім'ям: фото (основне), опис, посилання.
     *
     * @return array{id: int, name: string, image: string|null, profile: string|null, urls: list<string>}|null
     */
    public function artist(string $name, ?int $id = null): ?array
    {
        if ($id === null) {
            $search = $this->get('database/search', ['type' => 'artist', 'q' => $name, 'per_page' => 5]);
            $hit = collect((array) ($search['results'] ?? []))->first(fn ($r) => is_array($r)
                && MetaMatch::normalize((string) preg_replace('/\s*\(\d+\)$/', '', (string) ($r['title'] ?? ''))) === MetaMatch::normalize($name));
            $id = is_array($hit) ? (int) ($hit['id'] ?? 0) : 0;
        }
        $artist = $id ? $this->get('artists/'.$id, []) : null;
        if (! is_array($artist)) {
            return null;
        }
        $image = collect((array) ($artist['images'] ?? []))->first(fn ($img) => is_array($img) && ($img['type'] ?? '') === 'primary') ?? ($artist['images'][0] ?? null);
        // Розмітка Discogs: [a=Name], [l=Label], [url=…]…[/url] — прибираємо, лишаємо текст.
        $profile = trim((string) preg_replace(['/\[(a|l|r|m)=([^\]]+)\]/', '/\[\/?[a-z]+[^\]]*\]/', '/\s+/'], ['$2', '', ' '], (string) ($artist['profile'] ?? '')));

        return [
            'id' => (int) $artist['id'],
            'name' => (string) preg_replace('/\s*\(\d+\)$/', '', (string) ($artist['name'] ?? $name)),
            'image' => is_array($image) && filled($image['uri'] ?? null) ? (string) $image['uri'] : null,
            'profile' => $profile !== '' ? $profile : null,
            'urls' => array_values(array_filter((array) ($artist['urls'] ?? []), 'is_string')),
        ];
    }

    /** Перевірка токена в адмінці: /oauth/identity відповідає лише з правильним токеном. */
    public function test(): bool
    {
        try {
            return $this->http()->get($this->url('oauth/identity'))->successful();
        } catch (Throwable) {
            return false;
        }
    }

    /** «3:45» → 225 секунд. */
    public static function seconds(string $duration): ?int
    {
        if (! preg_match('/^(?:(\d+):)?(\d{1,2}):(\d{2})$/', trim($duration), $m)) {
            return null;
        }

        return (int) $m[1] * 3600 + (int) $m[2] * 60 + (int) $m[3];
    }

    /**
     * @param  array<string, mixed>  $release
     */
    private static function artistName(array $release): string
    {
        return trim(implode(' ', array_map(fn ($a) => preg_replace('/\s*\(\d+\)$/', '', (string) ($a['name'] ?? '')).' '.($a['join'] ?? ''), array_filter((array) ($release['artists'] ?? []), 'is_array'))));
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function get(string $path, array $query): ?array
    {
        if (! $this->configured()) {
            return null;
        }
        $key = 'music.discogs.'.md5($path.'?'.http_build_query($query));
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached === [] ? null : $cached;
        }

        try {
            Throttle::wait('discogs', (int) config('services.discogs.interval_ms', 1000));
            $response = $this->http()->get($this->url($path), $query);
            if ($response->status() === 404) {
                Cache::put($key, [], now()->addDays(7));

                return null;
            }
            $data = $response->successful() ? $response->json() : null;
        } catch (Throwable $e) {
            Log::warning('Discogs недоступний', ['path' => $path, 'error' => $e->getMessage()]);

            return null;
        }
        if (! is_array($data)) {
            return null;
        }
        Cache::put($key, $data ?: [], now()->addDays($data ? 30 : 7));

        return $data ?: null;
    }

    private function http(): PendingRequest
    {
        return Http::timeout(8)->acceptJson()->withHeaders([
            'User-Agent' => self::USER_AGENT,
            'Authorization' => 'Discogs token='.$this->token(),
        ]);
    }

    private function url(string $path): string
    {
        return rtrim((string) config('services.discogs.url'), '/').'/'.$path;
    }
}
