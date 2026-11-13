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
 * Імпорт списків аніме: Shikimori (за ніком, публічний профіль), MyAnimeList (файл експорту XML)
 * або Anixart (експорт закладок CSV — зіставляємо за назвами).
 * Id Shikimori збігається з MyAnimeList, тож тайтли знаходимо за shikimori_id каталогу.
 * Уже позначені тайтли не перезаписуються; імпорт не дає колекційних карток (вони — за перегляд на сайті).
 */
class AnimeListImport
{
    /** Статуси Shikimori й MyAnimeList → статуси GameCon. */
    private const STATUS = [
        'planned' => 'planned', 'plan to watch' => 'planned', 'watching' => 'watching', 'rewatching' => 'watching',
        'completed' => 'watched', 'on_hold' => 'on_hold', 'on-hold' => 'on_hold', 'dropped' => 'dropped',
        // Anixart (експорт закладок CSV, російською).
        'смотрю' => 'watching', 'просмотрено' => 'watched', 'в планах' => 'planned', 'брошено' => 'dropped', 'отложено' => 'on_hold',
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
     * Експорт закладок Anixart (CSV: №, назва, оригінальна назва, альтернативні, обране, статус).
     * У файлі трапляються лапки всередині назв, тому статус беремо з останньої колонки рядка.
     *
     * @return list<array{id: null, status: string, score: int, episodes: int, title: string, titles: list<string>}>
     */
    public function fromAnixartCsv(string $contents): array
    {
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents) ?? $contents;
        // fgetcsv коректно читає назви з переносами рядків у лапках.
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $contents);
        rewind($stream);
        $header = fgetcsv($stream, escape: '') ?: [];
        $lines = [];
        while (($cols = fgetcsv($stream, escape: '')) !== false) {
            $lines[] = $cols;
        }
        fclose($stream);
        if (count($header) < 6 || ! str_contains(mb_strtolower(implode(',', $header)), 'статус')) {
            throw ValidationException::withMessages(['file' => 'Це не схоже на експорт закладок Anixart (CSV).']);
        }
        $out = [];
        foreach ($lines as $cols) {
            if ($cols === [null] || count($cols) < 2) {
                continue;
            }
            $status = mb_strtolower(trim((string) end($cols)));
            $titles = array_values(array_filter([trim((string) ($cols[1] ?? '')), trim((string) ($cols[2] ?? ''))]));
            foreach (explode(',', (string) ($cols[3] ?? '')) as $alt) {
                $alt = trim($alt, " \t\"");
                if ($alt !== '' && $alt !== 'Не указаны' && mb_strlen($alt) <= 200) {
                    $titles[] = $alt;
                }
            }
            if ($titles === []) {
                continue;
            }
            $out[] = ['id' => null, 'status' => $status, 'score' => 0, 'episodes' => 0, 'title' => $titles[0], 'titles' => $titles];
        }

        return $out;
    }

    /** Назва для порівняння: без регістру, розділових знаків і зайвих пробілів. */
    private static function norm(string $title): string
    {
        return trim((string) preg_replace(['/[^\p{L}\p{N}]+/u'], ' ', mb_strtolower($title)));
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
        // Без id (Anixart) — шукаємо за назвами: українська, оригінальна й альтернативні.
        $byTitle = collect();
        if (collect($rows)->contains(fn ($r) => $r['id'] === null)) {
            Movie::query()->where('is_published', true)->get(['id', 'slug', 'title', 'title_original', 'poster_url', 'poster_path'])
                ->each(function (Movie $m) use (&$byTitle) {
                    foreach ([$m->title, $m->title_original] as $t) {
                        if (is_string($t) && $t !== '') {
                            $byTitle->put(self::norm($t), $m);
                        }
                    }
                });
        }
        $have = DB::table('movie_user')->where('user_id', $user->id)->whereNotNull('status')->pluck('status', 'movie_id');
        $matched = [];
        foreach ($rows as $r) {
            $movie = $r['id'] !== null ? $movies->get($r['id']) : null;
            foreach ($r['titles'] ?? [] as $t) {
                $movie ??= $byTitle->get(self::norm($t));
            }
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

        $found = array_column($matched, 'title', 'movie_id');
        $missing = [];
        foreach ($rows as $r) {
            if (count($missing) < 40 && ! in_array($r['title'], $found, true) && isset(self::STATUS[$r['status']])) {
                $missing[] = $r['title'];
            }
        }

        return ['matched' => $matched, 'unmatched' => count($rows) - count($matched), 'total' => count($rows), 'missing' => $missing];
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
