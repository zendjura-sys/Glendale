<?php

namespace App\Services\Cinema;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Статистика перегляду для профілю (№272): скільки переглянуто й дивиться, серій і годин
 * (орієнтовно: фільми — за тривалістю, серіали — серії × тривалість серії), улюблені жанри,
 * середня оцінка й «цього року». Кеш 10 хвилин.
 */
class WatchStats
{
    /** Тривалість серії, якщо в тайтлі її немає, хвилин. */
    private const EPISODE_MINUTES = 24;

    /** Тривалість фільму без даних, хвилин. */
    private const MOVIE_MINUTES = 110;

    /**
     * @return array{watched: int, watching: int, episodes: int, hours: int, this_year: int, avg_rating: float|null, genres: list<array{name: string, count: int}>}|null
     */
    public function of(User $user): ?array
    {
        return Cache::remember("watch_stats.{$user->id}", now()->addMinutes(10), function () use ($user) {
            $rows = DB::table('movie_user')->join('movies', 'movies.id', '=', 'movie_user.movie_id')
                ->where('movie_user.user_id', $user->id)
                ->get(['movie_user.status', 'movie_user.rating', 'movie_user.watched_at', 'movie_user.updated_at', 'movies.id', 'movies.type', 'movies.duration', 'movies.genres', 'movies.episodes_count']);
            $episodes = DB::table('movie_episode_marks')->where('user_id', $user->id)->get(['movie_id']);
            if ($rows->isEmpty() && $episodes->isEmpty()) {
                return null;
            }

            $byMovie = $rows->keyBy('id');
            $marks = $episodes->countBy('movie_id');
            $minutes = 0;
            foreach ($rows as $row) {
                // Одна серія (фільм, мультфільм, повний метр аніме) — за тривалістю тайтлу.
                $series = (int) $row->episodes_count > 1 || isset($marks[$row->id]);
                if (! $series) {
                    $minutes += $row->status === 'watched' ? (int) ($row->duration ?: self::MOVIE_MINUTES) : 0;

                    continue;
                }
                // Серіал: відмічені серії, а переглянутий без відміток — усі його серії.
                $count = max((int) ($marks[$row->id] ?? 0), $row->status === 'watched' ? (int) $row->episodes_count : 0);
                $minutes += $count * (int) ($row->duration && $row->duration < 90 ? $row->duration : self::EPISODE_MINUTES);
            }
            // Відмітки серій у тайтлах, яких немає в списках.
            foreach ($marks as $movieId => $count) {
                if (! $byMovie->has($movieId)) {
                    $minutes += (int) $count * self::EPISODE_MINUTES;
                }
            }

            $genres = [];
            foreach ($rows->whereIn('status', ['watched', 'watching']) as $row) {
                foreach ((array) json_decode((string) $row->genres, true) as $genre) {
                    if (is_string($genre) && $genre !== '') {
                        $genres[$genre] = ($genres[$genre] ?? 0) + 1;
                    }
                }
            }
            arsort($genres);
            $ratings = $rows->whereNotNull('rating')->pluck('rating');
            $year = now()->startOfYear();

            return [
                'watched' => $rows->where('status', 'watched')->count(),
                'watching' => $rows->where('status', 'watching')->count(),
                'episodes' => $episodes->count(),
                'hours' => (int) round($minutes / 60),
                'this_year' => $rows->where('status', 'watched')
                    ->filter(fn ($row) => ($row->watched_at ?? $row->updated_at) !== null && now()->parse($row->watched_at ?? $row->updated_at)->gte($year))->count(),
                'avg_rating' => $ratings->isNotEmpty() ? round((float) $ratings->avg(), 1) : null,
                'genres' => array_map(fn (string $name, int $count) => ['name' => $name, 'count' => $count], array_keys(array_slice($genres, 0, 3, true)), array_slice($genres, 0, 3)),
            ];
        });
    }
}
