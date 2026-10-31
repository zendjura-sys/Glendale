<?php

namespace App\Services\Music;

use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Last.fm API (ключ у Адмінка → Інтеграції): теги (жанри), біографії, схожі виконавці, підказки альбому.
 * Фото виконавців Last.fm з 2019 року — заглушки-зірочки, тому зображення звідси не беремо.
 * Відповіді (і «не знайдено») кешуються, збій — null.
 */
class LastFm
{
    /** Хеш картинки-заглушки Last.fm (сіра зірка) — така «обкладинка» нічого не означає. */
    public const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

    /** Службові теги, що не є жанрами. */
    private const NOT_GENRES = '/^(seen live|favorites?|favourites?|my|love|awesome|beautiful|albums? i own|\d{2,4}s?|male vocalists?|female vocalists?|under \d+.*)$/i';

    public function __construct(private readonly SiteSettings $settings) {}

    public function key(): ?string
    {
        return $this->settings->secret('lastfm_key') ?: config('services.lastfm.key');
    }

    public function configured(): bool
    {
        return filled($this->key()) && (bool) config('services.music_metadata.enabled', true);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function track(string $artist, string $title, ?string $mbid = null): ?array
    {
        return $this->call('track.getInfo', $mbid ? ['mbid' => $mbid] : ['artist' => $artist, 'track' => $title])['track'] ?? null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function artist(string $name, ?string $mbid = null): ?array
    {
        return $this->call('artist.getInfo', $mbid ? ['mbid' => $mbid] : ['artist' => $name])['artist'] ?? null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function album(string $artist, string $album): ?array
    {
        return $this->call('album.getInfo', ['artist' => $artist, 'album' => $album])['album'] ?? null;
    }

    /**
     * Жанри з тегів (найпопулярніші першими, без службових «seen live» тощо).
     *
     * @param  array<string, mixed>|null  $entity
     * @return list<string>
     */
    public static function genres(?array $entity): array
    {
        $tags = $entity['toptags']['tag'] ?? $entity['tags']['tag'] ?? [];
        $tags = is_array($tags) && isset($tags['name']) ? [$tags] : (array) $tags;

        return array_values(array_filter(array_map(
            fn ($t) => is_array($t) && ! preg_match(self::NOT_GENRES, trim((string) ($t['name'] ?? ''))) ? MusicBrainz::genreName((string) ($t['name'] ?? '')) : '',
            $tags,
        )));
    }

    /** Чи картинка Last.fm — заглушка. */
    public static function isPlaceholder(?string $url): bool
    {
        return blank($url) || str_contains((string) $url, self::PLACEHOLDER);
    }

    /** Перевірка ключа в адмінці. */
    public function test(): bool
    {
        $data = $this->call('artist.getInfo', ['artist' => 'Radiohead'], cache: false);

        return is_array($data) && isset($data['artist']);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null
     */
    private function call(string $method, array $params, bool $cache = true): ?array
    {
        $key = $this->key();
        if (! $key || ! config('services.music_metadata.enabled', true)) {
            return null;
        }
        $query = [...$params, 'method' => $method, 'api_key' => $key, 'format' => 'json', 'autocorrect' => 1];
        $cacheKey = 'music.lastfm.'.md5($method.'|'.json_encode($params));
        $cached = $cache ? Cache::get($cacheKey) : null;
        if (is_array($cached)) {
            return $cached === [] ? null : $cached;
        }

        try {
            $data = Http::timeout(8)->acceptJson()->withHeaders(['User-Agent' => MusicBrainz::USER_AGENT])
                ->get((string) config('services.lastfm.url'), $query)->json();
        } catch (Throwable $e) {
            Log::warning('Last.fm недоступний', ['method' => $method, 'error' => $e->getMessage()]);

            return null;
        }
        // Помилка 6 — «не знайдено»: кешуємо як порожнє; інші (ключ, ліміт) — не кешуємо.
        if (! is_array($data)) {
            return null;
        }
        if (isset($data['error'])) {
            if ((int) $data['error'] === 6) {
                Cache::put($cacheKey, [], now()->addDays(7));
            }

            return null;
        }
        Cache::put($cacheKey, $data, now()->addDays(14));

        return $data;
    }
}
