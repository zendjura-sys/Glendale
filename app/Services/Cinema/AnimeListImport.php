<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\User;
use App\Services\Cinema\Metadata\ShikimoriProvider;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Імпорт списків аніме: Shikimori (за ніком, публічний профіль) або MyAnimeList (файл експорту XML).
 * Id Shikimori збігається з MyAnimeList, тож тайтли знаходимо за shikimori_id каталогу.
 * Уже позначені тайтли не перезаписуються; імпорт не дає колекційних карток (вони — за перегляд на сайті).
 */
class AnimeListImport
{
    /** Статуси Shikimori й MyAnimeList → статуси GameCon. */
    private const STATUS = [
        'planned' => 'planned', 'plan to watch' => 'planned', 'watching' => 'watching', 'rewatching' => 'watching',
        'completed' => 'watched', 'on_hold' => 'on_hold', 'on-hold' => 'on_hold', 'dropped' => 'dropped',
    ];

    /**
     * @return list<array{id: string, status: string, score: int, episodes: int, title: string}>
     */
    public function fromShikimori(string $nickname): array
    {
        $nickname = trim($nickname);
        if ($nickname === '' || mb_strlen($nickname) > 60) {
            throw ValidationException::withMessages(['nickname' => 'Вкажіть нік на Shikimori.']);
        }
        try {
            return app(ShikimoriProvider::class)->userRates($nickname);
        } catch (CinemaException) {
            throw ValidationException::withMessages(['nickname' => 'Не вдалося отримати список — перевірте нік і що профіль відкритий.']);
        }
    }

    /**
     * Файл експорту MyAnimeList (XML, можна .gz).
     *
     * @return list<array{id: string, status: string, score: int, episodes: int, title: string}>
     */
    public function fromMalXml(string $contents): array
    {
        if (str_starts_with($contents, "\x1f\x8b")) {
            $contents = (string) @gzdecode($contents);
        }
        // Без мережі й без зовнішніх сутностей (захист від XXE).
        $xml = @simplexml_load_string($contents, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
        if ($xml === false || ! isset($xml->anime)) {
            throw ValidationException::withMessages(['file' => 'Це не схоже на експорт списку MyAnimeList (XML).']);
        }
        $out = [];
        foreach ($xml->anime as $a) {
            $out[] = [
                'id' => (string) $a->series_animedb_id,
                'status' => strtolower((string) $a->my_status),
                'score' => (int) $a->my_score,
                'episodes' => (int) $a->my_watched_episodes,
                'title' => (string) $a->series_title,
            ];
        }

        return $out;
    }

    /**
     * Збіги з каталогом.
     *
     * @param  list<array{id: string, status: string, score: int, episodes: int, title: string}>  $rows
     * @return array{matched: list<array<string, mixed>>, unmatched: int, total: int}
     */
    public function preview(User $user, array $rows): array
    {
        $ids = array_values(array_unique(array_filter(array_column($rows, 'id'))));
        $movies = Movie::query()->where('is_published', true)->whereIn('shikimori_id', $ids)->get(['id', 'slug', 'title', 'poster_url', 'poster_path', 'shikimori_id'])->keyBy('shikimori_id');
        $have = DB::table('movie_user')->where('user_id', $user->id)->whereNotNull('status')->pluck('status', 'movie_id');
        $matched = [];
        foreach ($rows as $r) {
            $movie = $movies->get($r['id']);
            $status = self::STATUS[$r['status']] ?? null;
            if (! $movie || ! $status) {
                continue;
            }
            $matched[] = [
                'movie_id' => $movie->id, 'slug' => $movie->slug, 'title' => $movie->title, 'poster' => $movie->poster,
                'status' => $status, 'rating' => $r['score'] >= 1 && $r['score'] <= 10 ? $r['score'] : null,
                'episodes' => $r['episodes'], 'current' => $have[$movie->id] ?? null,
            ];
        }

        return ['matched' => $matched, 'unmatched' => count($rows) - count($matched), 'total' => count($rows)];
    }

    /** Зберегти попередній перегляд на 30 хвилин (щоб імпорт не завантажував список удруге). */
    public function remember(User $user, array $preview): void
    {
        Cache::put('anime_import.'.$user->id, $preview['matched'], now()->addMinutes(30));
    }

    /**
     * @param  list<int>  $movieIds
     */
    public function import(User $user, array $movieIds): int
    {
        $matched = collect((array) Cache::get('anime_import.'.$user->id, []))->keyBy('movie_id');
        $added = 0;
        foreach ($movieIds as $id) {
            $row = $matched->get((int) $id);
            if (! $row || $row['current']) {
                continue;
            }
            $exists = DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $row['movie_id']);
            $values = ['status' => $row['status'], 'rating' => $row['rating'], 'watched_at' => $row['status'] === 'watched' ? now() : null, 'updated_at' => now()];
            if ($exists->exists()) {
                $exists->whereNull('status')->update($values);
            } else {
                DB::table('movie_user')->insert([...$values, 'user_id' => $user->id, 'movie_id' => $row['movie_id'], 'created_at' => now()]);
            }
            $added++;
        }
        Cache::forget('anime_import.'.$user->id);
        Log::info('cinema: anime list imported', ['user' => $user->id, 'added' => $added]);

        return $added;
    }
}
