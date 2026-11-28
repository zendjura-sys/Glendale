<?php

namespace App\Services\Music;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Відкритий каталог MusicBrainz (без ключа): записи, релізи, виконавці. Правила сервісу —
 * зрозумілий User-Agent і не частіше одного запиту на секунду, тому всі запити йдуть через
 * спільний замок у кеші. Відповіді (і «не знайдено») кешуються, збій — null.
 */
class MusicBrainz
{
    public const USER_AGENT = 'GameCon/1.0 (https://gamecon.online)';

    /** Мінімальна оцінка пошуку MusicBrainz (0–100), з якою запис вважаємо тим самим. */
    public const MIN_SEARCH_SCORE = 90;

    public function enabled(): bool
    {
        return (bool) config('services.music_metadata.enabled', true);
    }

    /**
     * Запис за MBID з релізами, жанрами й номерами доріжок.
     *
     * @return array<string, mixed>|null
     */
    public function recording(string $mbid): ?array
    {
        return $this->get('recording/'.rawurlencode($mbid), ['inc' => 'artist-credits+releases+release-groups+media+genres+tags']);
    }

    /**
     * Пошук запису за виконавцем і назвою: лише впевнені збіги (score ≥ 90) з тим самим
     * виконавцем і тривалістю ±5 с. Найкращий першим.
     *
     * @return list<array<string, mixed>>
     */
    public function searchRecordings(string $artist, string $title, ?int $duration = null): array
    {
        $query = sprintf('recording:"%s" AND artist:"%s"', $this->escape($title), $this->escape($artist));
        $data = $this->get('recording', ['query' => $query, 'limit' => 10]);
        $found = [];
        foreach ((array) ($data['recordings'] ?? []) as $recording) {
            if (! is_array($recording) || (int) ($recording['score'] ?? 0) < self::MIN_SEARCH_SCORE) {
                continue;
            }
            $length = isset($recording['length']) ? (int) round(((int) $recording['length']) / 1000) : null;
            if (! MetaMatch::sameArtist(self::credit($recording), $artist) || ! MetaMatch::sameTitle((string) ($recording['title'] ?? ''), $title)
                || ! MetaMatch::durationOk($length, $duration)) {
                continue;
            }
            $found[] = $recording;
        }

        return $found;
    }

    /**
     * Виконавець за MBID: тип, місце, роки, жанри й посилання (Wikidata, Spotify…).
     *
     * @return array<string, mixed>|null
     */
    public function artist(string $mbid): ?array
    {
        return $this->get('artist/'.rawurlencode($mbid), ['inc' => 'url-rels+genres+tags']);
    }

    /**
     * Виконавець за ім'ям: точний збіг імені (без регістру й діакритики) з оцінкою ≥ 90.
     *
     * @return list<array<string, mixed>>
     */
    public function searchArtists(string $name): array
    {
        $data = $this->get('artist', ['query' => 'artist:"'.$this->escape($name).'"', 'limit' => 5]);

        return array_values(array_filter((array) ($data['artists'] ?? []), fn ($a) => is_array($a)
            && (int) ($a['score'] ?? 0) >= self::MIN_SEARCH_SCORE
            && MetaMatch::normalize((string) ($a['name'] ?? '')) === MetaMatch::normalize($name)));
    }

    /**
     * Найраніший офіційний реліз-альбом запису (якщо альбому немає — найраніший офіційний будь-який):
     * назва, рік, номер доріжки, MBID релізу й групи релізів.
     *
     * @param  array<string, mixed>  $recording
     * @return array{album: string, year: int|null, track_no: int|null, release_mbid: string, release_group_mbid: string|null, type: string|null}|null
     */
    public static function bestRelease(array $recording): ?array
    {
        $releases = array_values(array_filter((array) ($recording['releases'] ?? []), 'is_array'));
        $official = array_values(array_filter($releases, fn ($r) => strtolower((string) ($r['status'] ?? 'official')) === 'official'));
        $albums = array_values(array_filter($official, fn ($r) => strtolower((string) ($r['release-group']['primary-type'] ?? '')) === 'album'
            && ($r['release-group']['secondary-types'] ?? []) === []));
        $pool = $albums ?: $official;
        if ($pool === []) {
            return null;
        }
        // Без дати — у кінець.
        usort($pool, fn ($a, $b) => (($a['date'] ?? '') ?: '9999') <=> (($b['date'] ?? '') ?: '9999'));
        $release = $pool[0];

        $trackNo = null;
        foreach ((array) ($release['media'] ?? []) as $medium) {
            $tracks = $medium['track'] ?? $medium['tracks'] ?? [];
            $number = is_array($tracks) ? ($tracks[0]['number'] ?? $tracks[0]['position'] ?? null) : null;
            if (is_numeric($number)) {
                $trackNo = (int) $number;
                break;
            }
        }
        preg_match('/^(\d{4})/', (string) ($release['date'] ?? ''), $m);

        return [
            'album' => (string) ($release['title'] ?? ''),
            'year' => isset($m[1]) ? (int) $m[1] : null,
            'track_no' => $trackNo > 0 && $trackNo < 1000 ? $trackNo : null,
            'release_mbid' => (string) ($release['id'] ?? ''),
            'release_group_mbid' => $release['release-group']['id'] ?? null,
            'type' => $release['release-group']['primary-type'] ?? null,
        ];
    }

    /**
     * Найпопулярніший жанр (genres, потім tags) запису чи виконавця.
     *
     * @param  array<string, mixed>  $entity
     */
    public static function topGenre(array $entity): ?string
    {
        return self::genres($entity)[0] ?? null;
    }

    /**
     * @param  array<string, mixed>  $entity
     * @return list<string>
     */
    public static function genres(array $entity): array
    {
        $list = array_values(array_filter((array) ($entity['genres'] ?? []), 'is_array')) ?: array_values(array_filter((array) ($entity['tags'] ?? []), 'is_array'));
        usort($list, fn ($a, $b) => (int) ($b['count'] ?? 0) <=> (int) ($a['count'] ?? 0));

        return array_values(array_filter(array_map(fn ($g) => self::genreName((string) ($g['name'] ?? '')), $list)));
    }

    public static function genreName(string $name): string
    {
        $name = trim($name);

        return $name === '' ? '' : mb_substr(mb_convert_case($name, MB_CASE_TITLE), 0, 40);
    }

    /**
     * Виконавці запису одним рядком («A feat. B»).
     *
     * @param  array<string, mixed>  $entity
     */
    public static function credit(array $entity): string
    {
        $credit = '';
        foreach ((array) ($entity['artist-credit'] ?? []) as $part) {
            if (is_array($part)) {
                $credit .= ($part['name'] ?? $part['artist']['name'] ?? '').($part['joinphrase'] ?? '');
            }
        }

        return trim($credit);
    }

    /**
     * MBID першого виконавця запису.
     *
     * @param  array<string, mixed>  $entity
     */
    public static function artistId(array $entity): ?string
    {
        $id = $entity['artist-credit'][0]['artist']['id'] ?? null;

        return is_string($id) ? $id : null;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function get(string $path, array $query): ?array
    {
        if (! $this->enabled()) {
            return null;
        }
        $query = [...$query, 'fmt' => 'json'];
        $key = 'music.mb.'.md5($path.'?'.http_build_query($query));

        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached === [] ? null : $cached;
        }

        try {
            Throttle::wait('musicbrainz', (int) config('services.musicbrainz.interval_ms', 1100));
            $response = Http::timeout(8)->acceptJson()->withHeaders(['User-Agent' => self::USER_AGENT])
                ->get(rtrim((string) config('services.musicbrainz.url'), '/').'/'.$path, $query);
            if ($response->status() === 404) {
                Cache::put($key, [], now()->addDays(7));

                return null;
            }
            $data = $response->successful() ? $response->json() : null;
        } catch (Throwable $e) {
            Log::warning('MusicBrainz недоступний', ['path' => $path, 'error' => $e->getMessage()]);

            return null;
        }
        if (! is_array($data)) {
            return null;
        }
        Cache::put($key, $data ?: [], now()->addDays($data ? 30 : 7));

        return $data ?: null;
    }

    /** Екранування спецсимволів Lucene у пошуковому запиті. */
    private function escape(string $value): string
    {
        return (string) preg_replace('/([+\-&|!(){}\[\]^"~*?:\\\\\/])/', '\\\\$1', trim($value));
    }
}
