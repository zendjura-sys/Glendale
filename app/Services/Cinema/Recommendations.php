<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * «Вам сподобається»: гібридні рекомендації кіно.
 *  1) спільний смак — що високо оцінили глядачі, яким сподобалося те саме, що й вам;
 *  2) жанри — вага жанрів із ваших оцінок і переглядів, мінус жанри кинутих тайтлів;
 *  3) якість і популярність — як легка добавка, щоб не пропонувати слабке.
 * Без уже позначених і без «Не цікаво». Кожен тайтл має пояснення «Бо вам сподобалося …».
 */
class Recommendations
{
    /** Позитивний сигнал: оцінка від 7 або переглянуто/дивлюся без низької оцінки. */
    private const LIKED_RATING = 7;

    /**
     * @return list<array{movie: Movie, reason: string|null, score: float}>
     */
    public function for(User $user, int $limit = 24): array
    {
        $ids = Cache::remember($this->key($user), now()->addMinutes(30), fn () => $this->compute($user));
        $reasons = $ids['reasons'];
        $scores = $ids['scores'];
        $dismissed = DB::table('movie_dismissals')->where('user_id', $user->id)->pluck('movie_id')->all();
        $pick = array_slice(array_values(array_diff(array_keys($scores), $dismissed)), 0, $limit);
        $movies = Movie::query()->published()->whereIn('id', $pick)->get()->keyBy('id');

        $out = [];
        foreach ($pick as $id) {
            if ($movies->has($id)) {
                $out[] = ['movie' => $movies[$id], 'reason' => $reasons[$id] ?? null, 'score' => $scores[$id]];
            }
        }

        return $out;
    }

    public function dismiss(User $user, Movie $movie): void
    {
        DB::table('movie_dismissals')->insertOrIgnore(['user_id' => $user->id, 'movie_id' => $movie->id, 'created_at' => now()]);
    }

    /** Скидає кеш після оцінки чи зміни статусу. */
    public function forget(User $user): void
    {
        Cache::forget($this->key($user));
    }

    private function key(User $user): string
    {
        return 'cinema_recs:'.$user->id;
    }

    /**
     * @return array{scores: array<int, float>, reasons: array<int, string>}
     */
    private function compute(User $user): array
    {
        $mine = DB::table('movie_user')->where('user_id', $user->id)->get(['movie_id', 'status', 'rating', 'updated_at']);
        $seen = $mine->pluck('movie_id')->map(fn ($id) => (int) $id)->all();
        $liked = $mine->filter(fn ($r) => $r->rating !== null ? $r->rating >= self::LIKED_RATING : in_array($r->status, ['watched', 'watching'], true))
            ->sortByDesc('updated_at')->take(60);
        $dropped = $mine->filter(fn ($r) => $r->status === 'dropped' || ($r->rating !== null && $r->rating <= 4))->pluck('movie_id')->all();

        if ($liked->isEmpty()) {
            return $this->popular($seen);
        }

        // Вага кожного «насіння»: оцінка/10, без оцінки — 0.7.
        $seedWeight = $liked->mapWithKeys(fn ($r) => [(int) $r->movie_id => $r->rating !== null ? $r->rating / 10 : 0.7])->all();
        $seedMovies = Movie::query()->whereIn('id', array_keys($seedWeight))->get(['id', 'title', 'genres'])->keyBy('id');

        // Жанрові ваги.
        $genres = [];
        foreach ($seedMovies as $m) {
            foreach ((array) ($m->genres ?? []) as $g) {
                if (is_string($g)) {
                    $genres[$g] = ($genres[$g] ?? 0) + $seedWeight[$m->id];
                }
            }
        }
        foreach (Movie::query()->whereIn('id', $dropped)->pluck('genres') as $list) {
            foreach ((array) $list as $g) {
                if (is_string($g)) {
                    $genres[$g] = ($genres[$g] ?? 0) - 0.5;
                }
            }
        }
        arsort($genres);
        $maxGenre = max(1.0, (float) (reset($genres) ?: 1));

        // Спільний смак: сусіди за перетином вподобань.
        $positive = fn ($q) => $q->where(fn ($w) => $w->where('rating', '>=', self::LIKED_RATING)
            ->orWhere(fn ($x) => $x->whereNull('rating')->whereIn('status', ['watched', 'watching'])));
        $neighbours = DB::table('movie_user')->whereIn('movie_id', array_keys($seedWeight))->where('user_id', '!=', $user->id)
            ->where($positive)->groupBy('user_id')->orderByRaw('count(*) desc')->limit(200)
            ->selectRaw('user_id, count(*) as overlap')->pluck('overlap', 'user_id');

        $cf = [];
        if ($neighbours->isNotEmpty()) {
            DB::table('movie_user')->whereIn('user_id', $neighbours->keys())->whereNotIn('movie_id', $seen)->where($positive)
                ->get(['user_id', 'movie_id'])
                ->each(function ($row) use (&$cf, $neighbours) {
                    $cf[(int) $row->movie_id] = ($cf[(int) $row->movie_id] ?? 0) + sqrt((float) $neighbours[$row->user_id]);
                });
        }
        $maxCf = $cf === [] ? 1.0 : max($cf);

        // Кандидати: з колаборативного сигналу + тайтли улюблених жанрів.
        $topGenres = array_slice(array_keys(array_filter($genres, fn ($w) => $w > 0)), 0, 5);
        arsort($cf);
        $candidateIds = array_slice(array_keys($cf), 0, 300);
        $byGenre = Movie::query()->published()->whereNotIn('id', $seen)
            ->where(function ($q) use ($topGenres) {
                foreach ($topGenres as $g) {
                    $q->orWhereJsonContains('genres', $g);
                }
            })
            ->orderByDesc('views_count')->limit(300)->pluck('id')->all();
        $candidates = Movie::query()->published()->whereIn('id', array_unique([...$candidateIds, ...($topGenres === [] ? [] : $byGenre)]))
            ->get(['id', 'genres', 'views_count', 'rating_imdb', 'rating_tmdb', 'rating_shikimori']);

        $scores = [];
        $reasons = [];
        $maxViews = max(1, (int) $candidates->max('views_count'));
        foreach ($candidates as $movie) {
            $g = 0.0;
            foreach ((array) ($movie->genres ?? []) as $name) {
                $g += is_string($name) ? max(0, $genres[$name] ?? 0) : 0;
            }
            $rating = (float) ($movie->rating_imdb ?? $movie->rating_tmdb ?? $movie->rating_shikimori ?? 6.5);
            $score = 2.0 * (($cf[$movie->id] ?? 0) / $maxCf)
                + 1.2 * min(1.0, $g / ($maxGenre * 2))
                + 0.4 * max(0, ($rating - 5) / 5)
                + 0.3 * log(1 + $movie->views_count) / log(1 + $maxViews);
            $scores[$movie->id] = round($score, 4);
            $reasons[$movie->id] = $this->reason($movie, $seedMovies, $seedWeight);
        }
        arsort($scores);

        return ['scores' => array_slice($scores, 0, 120, true), 'reasons' => $reasons];
    }

    /**
     * Пояснення: тайтл із ваших вподобань із найбільшим перетином жанрів.
     *
     * @param  Collection<int, Movie>  $seeds
     * @param  array<int, float>  $weights
     */
    private function reason(Movie $movie, Collection $seeds, array $weights): ?string
    {
        $mine = array_filter((array) ($movie->genres ?? []), 'is_string');
        $best = null;
        $bestScore = 0.0;
        foreach ($seeds as $seed) {
            $overlap = count(array_intersect($mine, array_filter((array) ($seed->genres ?? []), 'is_string')));
            $score = $overlap * $weights[$seed->id];
            if ($overlap > 0 && $score > $bestScore) {
                $best = $seed;
                $bestScore = $score;
            }
        }

        return $best !== null ? 'Бо вам сподобалося «'.$best->title.'»' : null;
    }

    /**
     * Холодний старт: популярне за тиждень серед глядачів.
     *
     * @param  list<int>  $seen
     * @return array{scores: array<int, float>, reasons: array<int, string>}
     */
    private function popular(array $seen): array
    {
        $ids = DB::table('movie_user')->where('updated_at', '>=', now()->subWeeks(2))->whereNotIn('movie_id', $seen)
            ->groupBy('movie_id')->orderByRaw('count(*) desc')->limit(60)->pluck('movie_id')->all();
        if (count($ids) < 12) {
            $ids = [...$ids, ...Movie::query()->published()->whereNotIn('id', [...$seen, ...$ids])->orderByDesc('views_count')->limit(60)->pluck('id')->all()];
        }
        $scores = [];
        foreach (array_values($ids) as $i => $id) {
            $scores[(int) $id] = (float) (1000 - $i);
        }

        return ['scores' => $scores, 'reasons' => array_fill_keys(array_keys($scores), 'Популярне зараз')];
    }
}
