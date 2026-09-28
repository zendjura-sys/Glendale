<?php

namespace App\Cinema;

use Illuminate\Support\Facades\Http;

/**
 * Shikimori (shikimori.one) — каталог аніме, окремий від TMDB: дає
 * shikimori_id, за яким Kodik::search() шукає точніше, ніж за назвою/роком
 * (у TMDB азійський контент часто без IMDb id чи з розбіжною назвою).
 * Автоматично підставляється при імпорті аніме з TMDB (Importer::import)
 * і повторно перевіряється в cinema:auto-import — не вимагає токена,
 * пошук за назвою — публічний ендпоінт API.
 *
 * https://shikimori.one/api/doc/1.0/animes/index — "Please do not parse
 * the main site. Fetch all necessary data via API." — саме так і робимо.
 */
final class Shikimori
{
    public const API = 'https://shikimori.one/api';

    /** Пошук за назвою — публічний, токена не треба; лише свій User-Agent (вимога API). */
    public static function configured(): bool
    {
        return true;
    }

    /**
     * Найкращий збіг за назвою (і роком, коли кандидатів декілька) —
     * консервативно: краще не знайти нічого, ніж прив'язати не той
     * тайтл (Kodik після цього шукатиме саме за цим id).
     */
    public static function search(Title $title): ?array
    {
        $queries = array_unique(array_filter([$title->original_name, $title->name]));
        foreach ($queries as $query) {
            try {
                $response = Http::timeout(15)->connectTimeout(8)->acceptJson()
                    ->withHeaders(['User-Agent' => 'GameConnect CineCon (+https://gamecon.online)'])
                    ->get(self::API.'/animes', ['search' => $query, 'limit' => 5]);
            } catch (\Throwable) {
                continue;
            }
            $results = (array) ($response->json() ?? []);
            if ($match = self::pickBest($results, $title)) {
                return $match;
            }
        }

        return null;
    }

    /** @param  list<array<string, mixed>>  $results */
    private static function pickBest(array $results, Title $title): ?array
    {
        if (! $results) {
            return null;
        }

        $normalize = fn (?string $s) => mb_strtolower(trim((string) $s));
        $ours = array_filter([$normalize($title->name), $normalize($title->original_name)]);

        $exact = array_values(array_filter($results, function ($r) use ($normalize, $ours) {
            $candidates = [$normalize($r['name'] ?? null), $normalize($r['russian'] ?? null)];

            return (bool) array_intersect($ours, $candidates);
        }));

        if (count($exact) === 1) {
            return $exact[0];
        }
        if (count($exact) > 1 && $title->year) {
            $byYear = array_values(array_filter($exact, fn ($r) => str_starts_with((string) ($r['aired_on'] ?? ''), (string) $title->year)));
            if (count($byYear) === 1) {
                return $byYear[0];
            }
        }
        // Жодного точного збігу, але лише один результат узагалі — і рік сходиться.
        if (! $exact && count($results) === 1 && $title->year
            && str_starts_with((string) ($results[0]['aired_on'] ?? ''), (string) $title->year)) {
            return $results[0];
        }

        return null;
    }

    /** @return bool чи знайдено */
    public static function attach(Title $title): bool
    {
        $match = self::search($title);
        $title->shikimori_checked_at = now();
        if (! $match) {
            $title->save();

            return false;
        }
        $title->shikimori_id = (int) $match['id'];
        $title->save();

        return true;
    }
}
