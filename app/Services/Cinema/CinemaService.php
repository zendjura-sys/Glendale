<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CinemaService
{
    public function __construct(
        private readonly KodikClient $kodik,
        private readonly FlixcdnPlayer $flixcdn,
    ) {}

    /**
     * Імпортує кандидата з Kodik: створює фільм або оновлює наявний за зовнішніми ID.
     *
     * @param  array<string, mixed>  $candidate
     */
    public function import(array $candidate, ?User $by = null): Movie
    {
        return DB::transaction(function () use ($candidate, $by) {
            $movie = $this->findExisting($candidate) ?? new Movie(['user_id' => $by?->id]);
            $fresh = ! $movie->exists;

            $meta = collect($candidate)->only([
                'type', 'title', 'title_original', 'year', 'description', 'poster_url', 'backdrop_url', 'genres', 'countries',
                'duration', 'age_rating', 'rating_kp', 'rating_imdb', 'rating_shikimori', 'kinopoisk_id', 'imdb_id', 'shikimori_id', 'episodes_count',
            ])->filter(fn ($v) => $v !== null && $v !== [] && $v !== '')->all();

            $movie->fill($fresh ? $meta : array_filter($meta, fn ($v, $k) => blank($movie->getAttribute($k)), ARRAY_FILTER_USE_BOTH));
            $movie->title = Str::limit((string) ($movie->title ?: 'Без назви'), 200, '');
            $movie->slug ??= $this->uniqueSlug($movie->title, $movie->year);
            $movie->save();

            $this->syncSources($movie, 'kodik', $candidate['sources'] ?? []);

            return $movie;
        });
    }

    /**
     * Оновлює озвучки Kodik для фільму, якщо в нього є зовнішній ID.
     */
    public function refreshKodik(Movie $movie): int
    {
        $criteria = array_filter([
            'kinopoisk_id' => $movie->kinopoisk_id,
            'shikimori_id' => $movie->kinopoisk_id ? null : $movie->shikimori_id,
            'imdb_id' => $movie->kinopoisk_id || $movie->shikimori_id ? null : $movie->imdb_id,
        ]);
        if ($criteria === []) {
            throw new CinemaException('У фільму немає ID КіноПошуку, Shikimori чи IMDb — Kodik не знайде його.', 422);
        }

        $sources = collect($this->kodik->search($criteria))->flatMap(fn (array $c) => $c['sources'])->all();
        $this->syncSources($movie, 'kodik', $sources);

        return count($sources);
    }

    /**
     * @param  list<array<string, mixed>>  $sources
     */
    public function syncSources(Movie $movie, string $provider, array $sources): void
    {
        $keep = [];
        foreach (array_values($sources) as $position => $source) {
            $model = $movie->sources()->getQuery()->firstOrNew(['provider' => $provider, 'external_id' => $source['external_id']]);
            $model->fill([...$source, 'provider' => $provider, 'position' => $position]);
            $model->movie()->associate($movie);
            $model->save();
            $keep[] = $model->id;
        }

        MovieSource::query()->where('movie_id', $movie->id)->where('provider', $provider)->whereNotIn('id', $keep)->delete();
    }

    /**
     * @param  array<string, mixed>  $candidate
     */
    public function findExisting(array $candidate): ?Movie
    {
        foreach (['kinopoisk_id', 'shikimori_id', 'imdb_id'] as $field) {
            if (filled($candidate[$field] ?? null)) {
                $movie = Movie::withTrashed()->where($field, $candidate[$field])->first();
                if ($movie) {
                    if ($movie->trashed()) {
                        $movie->restore();
                    }

                    return $movie;
                }
            }
        }

        return null;
    }

    public function uniqueSlug(string $title, ?int $year = null): string
    {
        $base = Str::limit(Str::slug(Str::transliterate($title).($year ? '-'.$year : '')) ?: 'movie', 140, '');
        $slug = $base;
        $i = 2;
        while (Movie::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /**
     * Усі доступні плеєри фільму: збережені джерела + динамічний FlixCDN.
     *
     * @return list<array<string, mixed>>
     */
    public function players(Movie $movie): array
    {
        $players = $movie->sources->map(fn (MovieSource $s) => $s->toPlayer())->all();

        if ($link = $this->flixcdn->link($movie)) {
            $players[] = [
                'key' => 'flixcdn',
                'id' => null,
                'provider' => 'flixcdn',
                'provider_label' => 'FlixCDN',
                'translation' => null,
                'translation_type' => null,
                'quality' => null,
                'link' => $link,
            ];
        }

        $order = array_flip(['kodik', 'flixcdn', 'custom']);
        usort($players, fn ($a, $b) => ($order[$a['provider']] ?? 9) <=> ($order[$b['provider']] ?? 9));

        return $players;
    }

    /**
     * @return array{status: string|null, rating: int|null}
     */
    public function stateFor(Movie $movie, User $user): array
    {
        $row = DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $movie->id)->first(['status', 'rating']);

        return ['status' => $row->status ?? null, 'rating' => isset($row->rating) ? (int) $row->rating : null];
    }

    public function setStatus(User $user, Movie $movie, ?string $status): void
    {
        $this->upsert($user, $movie, [
            'status' => $status,
            'watched_at' => $status === 'watched' ? now() : null,
        ]);
    }

    public function rate(User $user, Movie $movie, ?int $rating): void
    {
        $this->upsert($user, $movie, ['rating' => $rating]);
    }

    /**
     * Позначає «Дивлюся», коли користувач запустив плеєр (якщо ще немає статусу).
     */
    public function started(User $user, Movie $movie): void
    {
        $state = $this->stateFor($movie, $user);
        if ($state['status'] === null) {
            $this->setStatus($user, $movie, 'watching');
        } else {
            DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $movie->id)->update(['updated_at' => now()]);
        }
    }

    public function recordView(Movie $movie, Request $request): void
    {
        $key = 'cinema.viewed.'.$movie->id;
        if (! $request->session()->has($key)) {
            $request->session()->put($key, true);
            Movie::query()->whereKey($movie->id)->increment('views_count');
        }
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function upsert(User $user, Movie $movie, array $values): void
    {
        DB::transaction(function () use ($user, $movie, $values) {
            $query = DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $movie->id);
            if ($query->exists()) {
                $query->update([...$values, 'updated_at' => now()]);
            } else {
                DB::table('movie_user')->insert([
                    'user_id' => $user->id,
                    'movie_id' => $movie->id,
                    'status' => null,
                    'rating' => null,
                    ...$values,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $movie->id)
                ->whereNull('status')->whereNull('rating')->delete();

            $this->recount($movie);
        });
    }

    public function recount(Movie $movie): void
    {
        $stats = DB::table('movie_user')->where('movie_id', $movie->id)
            ->selectRaw('count(rating) as ratings_count, coalesce(sum(rating), 0) as ratings_sum, count(status) as watchers_count')
            ->first();

        $movie->forceFill([
            'ratings_count' => (int) $stats->ratings_count,
            'ratings_sum' => (int) $stats->ratings_sum,
            'watchers_count' => (int) $stats->watchers_count,
        ])->saveQuietly();
    }
}
