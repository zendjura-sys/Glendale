<?php

namespace App\Services\Music;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Пошук тексту пісні у відкритому каталозі LRCLIB (lrclib.net, без ключів): спершу точний збіг
 * за виконавцем, назвою й тривалістю, потім пошук. Повертає LRC із часом рядків, якщо є,
 * інакше звичайний текст. Результат (і «не знайдено») кешується, щоб не смикати сервіс.
 */
class LyricsFinder
{
    private const BASE = 'https://lrclib.net/api';

    public function find(string $artist, string $title, ?string $album = null, ?int $duration = null): ?string
    {
        $artist = trim($artist);
        $title = trim($title);
        if ($artist === '' || $title === '') {
            return null;
        }
        $key = 'lyrics.lrclib.'.md5(mb_strtolower($artist.'|'.$title));

        $found = Cache::remember($key, now()->addDays(30), fn () => $this->lookup($artist, $title, $album, $duration) ?? '');

        return $found === '' ? null : $found;
    }

    private function lookup(string $artist, string $title, ?string $album, ?int $duration): ?string
    {
        try {
            $http = Http::timeout(6)->acceptJson()->withHeaders(['User-Agent' => 'GameCon (https://gamecon.online)']);
            if ($duration) {
                $exact = $http->get(self::BASE.'/get', array_filter([
                    'artist_name' => $artist,
                    'track_name' => $title,
                    'album_name' => $album,
                    'duration' => $duration,
                ]));
                if ($exact->ok() && ($text = $this->text($exact->json()))) {
                    return $text;
                }
            }
            $search = $http->get(self::BASE.'/search', ['artist_name' => $artist, 'track_name' => $title]);
            if (! $search->ok()) {
                return null;
            }
            foreach ((array) $search->json() as $row) {
                // Тривалість має збігатися з точністю до кількох секунд — інакше це інша версія.
                if ($duration && isset($row['duration']) && abs((float) $row['duration'] - $duration) > 4) {
                    continue;
                }
                if ($text = $this->text($row)) {
                    return $text;
                }
            }
        } catch (Throwable) {
            return null;
        }

        return null;
    }

    private function text(mixed $row): ?string
    {
        if (! is_array($row) || ($row['instrumental'] ?? false)) {
            return null;
        }
        $text = trim((string) ($row['syncedLyrics'] ?? '')) ?: trim((string) ($row['plainLyrics'] ?? ''));

        return $text === '' ? null : $text;
    }
}
