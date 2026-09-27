<?php

namespace App\Cinema;

use Illuminate\Support\Facades\Http;

/**
 * Плеєр Kodik: за IMDb id (або назвою й роком) знаходить
 * посилання на iframe-плеєр і доступні озвучки. Токен — в адмінці,
 * зашифрований. Сам плеєр шле події postMessage (kodik_player_time_update
 * тощо) — на сторінці фільму з них зберігається прогрес перегляду.
 */
final class Kodik
{
    public const API = 'https://kodikapi.com';

    public static function configured(): bool
    {
        return (bool) CinemaSettings::kodikToken();
    }

    /**
     * Знайти плеєр для тайтлу й зберегти посилання та озвучки.
     *
     * @return bool чи знайдено
     */
    public static function attach(Title $title): bool
    {
        $results = self::search($title);
        $title->kodik_checked_at = now();
        if (! $results) {
            $title->save();

            return false;
        }

        $translations = collect($results)->map(fn ($r) => [
            'id' => $r['translation']['id'] ?? null,
            'title' => $r['translation']['title'] ?? 'Озвучка',
            'type' => $r['translation']['type'] ?? null,
            'quality' => $r['quality'] ?? null,
            'link' => self::normalizeLink($r['link'] ?? ''),
            'lastSeason' => $r['last_season'] ?? null,
            'lastEpisode' => $r['last_episode'] ?? null,
        ])->filter(fn ($t) => $t['link'] !== '')->unique('link')->values();

        // Українська озвучка — першою, якщо є.
        $sorted = $translations->sortBy(fn ($t) => preg_match('/укр|ukr|україн/iu', (string) $t['title']) ? 0 : 1)->values();
        $title->kodik_translations = $sorted->all();
        $title->kodik_link = $sorted->first()['link'] ?? null;
        $title->save();

        return $title->kodik_link !== null;
    }

    /** @return list<array<string, mixed>> */
    public static function search(Title $title): array
    {
        $token = CinemaSettings::kodikToken();
        if (! $token) {
            return [];
        }
        $queries = [];
        if ($title->imdb_id) {
            $queries[] = ['imdb_id' => $title->imdb_id];
        }
        $queries[] = array_filter(['title' => $title->original_name ?: $title->name, 'year' => $title->year]);

        foreach ($queries as $query) {
            try {
                $response = Http::timeout(15)->connectTimeout(8)->acceptJson()
                    ->get(self::API.'/search', $query + ['token' => $token, 'with_material_data' => 'true', 'limit' => 50]);
            } catch (\Throwable) {
                continue;
            }
            $results = (array) ($response->json('results') ?? []);
            $wantSerial = $title->isSeries();
            $results = array_values(array_filter($results, fn ($r) => str_contains((string) ($r['type'] ?? ''), 'serial') === $wantSerial));
            if ($results) {
                return $results;
            }
        }

        return [];
    }

    public static function normalizeLink(string $link): string
    {
        $link = trim($link);
        if ($link === '') {
            return '';
        }

        return str_starts_with($link, '//') ? 'https:'.$link : $link;
    }
}
