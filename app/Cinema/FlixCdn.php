<?php

namespace App\Cinema;

use Illuminate\Support\Facades\Http;

/**
 * Другий балансер плеєрів — FlixCDN (uacdn.live), працює паралельно з
 * Kodik: якщо в одного немає посилання чи він тимчасово лежить, сайт
 * пропонує глядачу інший. На відміну від Kodik (окреме посилання на
 * кожну озвучку), плеєр FlixCDN сам перемикає озвучки всередині свого
 * iframe — тому в нас це один пункт у списку джерел, а не декілька.
 * Заразом видає готові метадані (постер, опис, жанри) — придатний і як
 * запасне джерело обкладинок, коли їх нема в TMDB.
 */
final class FlixCdn
{
    public const API = 'https://api0.uacdn.live/api/';

    public static function configured(): bool
    {
        return (bool) CinemaSettings::flixcdnToken();
    }

    /**
     * Знайти плеєр для тайтлу й зберегти посилання та список озвучок.
     *
     * @return bool чи знайдено
     */
    public static function attach(Title $title): bool
    {
        $item = self::search($title);
        $title->flixcdn_checked_at = now();
        if (! $item) {
            $title->save();

            return false;
        }

        $link = self::normalizeLink((string) ($item['iframe_url'] ?? ''));
        $title->flixcdn_link = $link ?: null;
        $title->flixcdn_translations = collect($item['translations'] ?? [])
            ->map(fn ($t) => ['title' => $t['title'] ?? 'Озвучка'])->filter(fn ($t) => $t['title'] !== '')->values()->all();
        $title->save();

        return $title->flixcdn_link !== null;
    }

    /** Один найкращий збіг (API FlixCDN повертає готову картку тайтулу, не список джерел на озвучку). */
    public static function search(Title $title): ?array
    {
        $token = CinemaSettings::flixcdnToken();
        if (! $token) {
            return null;
        }

        $queries = [];
        if ($title->imdb_id) {
            $queries[] = ['imdb_id', $title->imdb_id];
        }
        $queries[] = ['title', $title->original_name ?: $title->name];

        foreach ($queries as [$key, $value]) {
            if ($value === null || $value === '') {
                continue;
            }
            try {
                $response = Http::timeout(15)->connectTimeout(8)->acceptJson()
                    ->get(self::API.'search', ['token' => $token, $key => $value]);
            } catch (\Throwable) {
                continue;
            }
            if (! $response->successful() || $response->json('error')) {
                continue;
            }
            $results = collect((array) ($response->json('result') ?? []));
            $wantSerial = $title->isSeries();
            $match = $results->first(fn ($r) => self::isSeries($r) === $wantSerial) ?? $results->first();
            if ($match) {
                return $match;
            }
        }

        return null;
    }

    private static function isSeries(array $item): bool
    {
        if (array_key_exists('has_series', $item)) {
            return (bool) $item['has_series'];
        }

        return in_array($item['type'] ?? '', [
            'serial', 'tv-series', 'anime-tv-series', 'tv-show', 'cartoon-series',
            'episode', 'tvshow', 'animeserial', 'showserial',
        ], true);
    }

    /** Постер FlixCDN — запасне джерело обкладинки, коли TMDB не дав своєї. */
    public static function poster(Title $title): ?string
    {
        $item = self::search($title);

        return $item['poster'] ?? $item['image_url'] ?? null;
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
