<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use App\Notifications\MovieRatingNotice;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CinemaService
{
    public const PROVIDERS = ['kodik', 'videoseed', 'flixcdn'];

    public function __construct(
        private readonly KodikClient $kodik,
        private readonly FlixcdnPlayer $flixcdn,
        private readonly FlixcdnClient $flixcdnApi,
        private readonly VideoseedClient $videoseed,
        private readonly CinemaPlayers $playerRules,
    ) {}

    /**
     * Імпортує кандидата з Kodik/FlixCDN: створює фільм або оновлює наявний за зовнішніми ID.
     * Озвучки кандидата додаються й оновлюються, решта плеєрів тайтлу лишається; метадані наявного фільму лише доповнюються.
     *
     * @param  array<string, mixed>  $candidate
     */
    public function import(array $candidate, ?User $by = null, string $provider = 'kodik', ?bool $publish = null, bool $restoreTrashed = true): ?Movie
    {
        return DB::transaction(function () use ($candidate, $by, $provider, $publish, $restoreTrashed) {
            $existing = $this->findExisting($candidate);
            if ($existing?->trashed()) {
                if (! $restoreTrashed) {
                    return null;
                }
                $existing->restore();
            }

            $movie = $existing ?? new Movie([
                'user_id' => $by?->id,
                'origin' => $provider,
                'is_published' => $publish ?? true,
            ]);
            $fresh = ! $movie->exists;

            $meta = collect($candidate)->only([
                'type', 'title', 'title_original', 'year', 'description', 'poster_url', 'backdrop_url', 'genres', 'countries',
                'duration', 'age_rating', 'rating_kp', 'rating_imdb', 'rating_shikimori', 'kinopoisk_id', 'imdb_id', 'shikimori_id', 'tmdb_id', 'episodes_count',
            ])->filter(fn ($v) => $v !== null && $v !== [] && $v !== '')->all();

            $movie->fill($fresh ? $meta : array_filter($meta, fn ($v, $k) => blank($movie->getAttribute($k)), ARRAY_FILTER_USE_BOTH));
            $movie->title = Str::limit((string) ($movie->title ?: 'Без назви'), 200, '');
            $movie->slug ??= $this->uniqueSlug($movie->title, $movie->year);
            $movie->synced_at = Carbon::now();
            $movie->save();

            $this->syncSources($movie, $provider, $candidate['sources'] ?? []);
            $movie->wasRecentlyCreated = $fresh;

            return $movie;
        });
    }

    /**
     * Оновлює плеєри з усіх налаштованих провайдерів.
     *
     * @return array<string, int> кількість озвучок за провайдером
     */
    public function refresh(Movie $movie): array
    {
        $found = $this->fetchPlayers($movie);
        if ($found === []) {
            throw new CinemaException('Жоден провайдер плеєрів не налаштований.', 422);
        }
        $result = [];
        foreach ($found as $provider => $sources) {
            if ($sources !== null) {
                $this->syncSources($movie, $provider, $sources, true);
                $result[$provider] = count($sources);
            }
        }
        $movie->forceFill(['synced_at' => Carbon::now()])->saveQuietly();

        return $result;
    }

    /**
     * Озвучки тайтлу в кожного налаштованого провайдера (без запису).
     * null — провайдер не зміг шукати (немає потрібного ID); помилки API пробрасываются.
     *
     * @param  list<string>|null  $only  лише ці провайдери
     * @return array<string, list<array<string, mixed>>|null>
     */
    public function fetchPlayers(Movie $movie, ?array $only = null): array
    {
        $want = fn (string $provider) => $only === null || in_array($provider, $only, true);
        $result = [];
        if ($want('kodik') && $this->kodik->configured()) {
            // Шукаємо за кожним ID окремо й об’єднуємо: в аніме частина озвучок у Kodik прив’язана лише
            // до Shikimori (без Кінопошуку). ID, яких у тайтлу немає, беремо з відповідей самого Kodik
            // (запис однієї озвучки знає Shikimori/IMDb) і шукаємо ще раз — так знаходяться всі озвучки.
            $queue = array_filter([
                'kinopoisk_id' => $movie->kinopoisk_id,
                'shikimori_id' => $movie->shikimori_id,
                'imdb_id' => $movie->imdb_id,
            ], fn ($v) => filled($v));
            $sources = null;
            if ($queue !== []) {
                $byId = [];
                $searched = [];
                $learned = [];
                $rounds = 0;
                while ($queue !== [] && $rounds++ < 6) {
                    $field = (string) array_key_first($queue);
                    $value = (string) array_shift($queue);
                    $searched[$field.':'.$value] = true;
                    foreach ($this->kodik->search([$field => $value]) as $candidate) {
                        foreach ($this->sourceList($candidate['sources'] ?? null) as $source) {
                            $byId[(string) ($source['external_id'] ?? '')] ??= $source;
                        }
                        foreach (['kinopoisk_id', 'shikimori_id', 'imdb_id'] as $key) {
                            $id = $candidate[$key] ?? null;
                            if (! filled($id) || isset($searched[$key.':'.$id]) || isset($queue[$key])) {
                                continue;
                            }
                            // Лише якщо цей ID у тайтлу ще не заданий (не тягнемо чужий тайтл з іншим ID).
                            if (filled($movie->{$key}) && (string) $movie->{$key} !== (string) $id) {
                                continue;
                            }
                            $queue[$key] = (string) $id;
                            $learned[$key] = (string) $id;
                        }
                    }
                }
                $sources = array_values($byId);
                $learned = array_filter($learned, fn ($v, $k) => blank($movie->{$k}), ARRAY_FILTER_USE_BOTH);
                if ($learned !== [] && $movie->exists) {
                    $movie->forceFill($learned)->saveQuietly();
                }
            }
            $result['kodik'] = $sources;
        }
        if ($want('flixcdn') && $this->flixcdnApi->searchTemplate()) {
            $sources = [];
            foreach ($this->flixcdnApi->search([
                'kinopoisk_id' => $movie->kinopoisk_id,
                'imdb_id' => $movie->imdb_id,
                'title' => $movie->title,
            ]) as $candidate) {
                if (! $this->matches($movie, $candidate)) {
                    continue;
                }
                foreach ($this->sourceList($candidate['sources'] ?? null) as $source) {
                    $sources[] = $source;
                }
            }
            $result['flixcdn'] = $sources;
        }
        if ($want('videoseed') && $this->videoseed->configured()) {
            $sources = null;
            if ($movie->kinopoisk_id || $movie->imdb_id || $movie->tmdb_id) {
                $sources = [];
                foreach ($this->videoseed->search([
                    'kinopoisk_id' => $movie->kinopoisk_id,
                    'imdb_id' => $movie->imdb_id,
                    'tmdb_id' => $movie->tmdb_id,
                ]) as $candidate) {
                    foreach ($this->sourceList($candidate['sources'] ?? null) as $source) {
                        $sources[] = $source;
                    }
                }
            }
            $result['videoseed'] = $sources;
        }

        return $result;
    }

    /**
     * Проставка плеєрів: нові озвучки додаються завжди; наявні — оновлюються лише з $replace.
     * Озвучки, яких провайдер цього разу не віддав, не видаляються одразу: їх прибирає лише
     * тривала відсутність (MovieSource::RETIRE_DAYS), і тільки коли провайдер щось повернув.
     *
     * @param  list<array<string, mixed>>  $sources
     * @return array{added: int, replaced: int, removed: int}
     */
    public function mergeSources(Movie $movie, string $provider, array $sources, bool $replace): array
    {
        $stats = ['added' => 0, 'replaced' => 0, 'removed' => 0];
        $existing = MovieSource::query()->where('movie_id', $movie->id)->where('provider', $provider)->get()->keyBy('external_id');
        $next = $existing->count();
        $seen = [];
        foreach ($sources as $position => $source) {
            $id = (string) ($source['external_id'] ?? '');
            if ($id === '' || ! filled($source['link'] ?? null)) {
                continue;
            }
            $seen[] = $id;
            $values = array_intersect_key($source, array_flip(['translation', 'translation_type', 'quality', 'link', 'episodes']));
            /** @var MovieSource|null $model */
            $model = $existing->get($id);
            if ($model === null) {
                $model = new MovieSource([...$values, 'provider' => $provider, 'external_id' => $id, 'position' => $next++]);
                $model->movie()->associate($movie);
                $model->save();
                $stats['added']++;

                continue;
            }
            $model->missing_since = null;
            if ($replace) {
                $model->fill([...$values, 'position' => $position]);
                if ($model->isDirty(['link', 'translation', 'translation_type', 'quality'])) {
                    $stats['replaced']++;
                }
            } elseif (isset($values['episodes'])) {
                // Кількість серій росте — її оновлюємо завжди, решту лишаємо як є.
                $model->episodes = $values['episodes'];
            }
            $model->save();
        }
        $stats['removed'] = $this->retire($movie, $provider, $seen);

        return $stats;
    }

    /**
     * Озвучки провайдера, яких не було у відповіді, позначаються зниклими; прибираються лише ті,
     * що зникли понад MovieSource::RETIRE_DAYS днів тому. Порожня відповідь нічого не чіпає.
     *
     * @param  list<string>  $seen  external_id з відповіді провайдера
     */
    private function retire(Movie $movie, string $provider, array $seen): int
    {
        if ($seen === []) {
            return 0;
        }
        $missing = MovieSource::query()->where('movie_id', $movie->id)->where('provider', $provider)->whereNotIn('external_id', $seen);
        (clone $missing)->whereNull('missing_since')->update(['missing_since' => Carbon::now()]);

        return (clone $missing)->where('missing_since', '<', Carbon::now()->subDays(MovieSource::RETIRE_DAYS))->delete();
    }

    /**
     * Оновлює озвучки Kodik для фільму, якщо в нього є зовнішній ID.
     */
    public function refreshKodik(Movie $movie): int
    {
        $sources = $this->fetchPlayers($movie, ['kodik'])['kodik'] ?? null;
        if ($sources === null) {
            throw new CinemaException('У фільму немає зовнішнього ID (IMDb, Shikimori) — Kodik не знайде його.', 422);
        }
        $this->syncSources($movie, 'kodik', $sources, true);

        return count($sources);
    }

    /**
     * @param  array<string, mixed>  $candidate
     */
    private function matches(Movie $movie, array $candidate): bool
    {
        foreach (['kinopoisk_id', 'imdb_id'] as $field) {
            if ($movie->{$field} && filled($candidate[$field] ?? null)) {
                return $movie->{$field} === $candidate[$field];
            }
        }

        return mb_strtolower((string) $candidate['title']) === mb_strtolower($movie->title)
            && (! $movie->year || ! $candidate['year'] || $movie->year === $candidate['year']);
    }

    /**
     * Записує озвучки провайдера, нічого не видаляючи одразу: інші озвучки й плеєри тайтлу лишаються.
     * $complete — це повна відповідь провайдера (оновлення плеєрів), а не один результат каталогу:
     * лише тоді давно зниклі озвучки прибираються (див. retire()).
     *
     * @param  list<array<string, mixed>>  $sources
     */
    public function syncSources(Movie $movie, string $provider, array $sources, bool $complete = false): void
    {
        $existing = MovieSource::query()->where('movie_id', $movie->id)->where('provider', $provider)->get()->keyBy('external_id');
        $next = (int) MovieSource::query()->where('movie_id', $movie->id)->max('position') + 1;
        $seen = [];
        foreach ($sources as $source) {
            $id = (string) ($source['external_id'] ?? '');
            if ($id === '' || ! filled($source['link'] ?? null)) {
                continue;
            }
            $seen[] = $id;
            $values = array_intersect_key($source, array_flip(['translation', 'translation_type', 'quality', 'link', 'episodes']));
            /** @var MovieSource|null $model */
            $model = $existing->get($id);
            if ($model === null) {
                $model = new MovieSource(['provider' => $provider, 'external_id' => $id, 'position' => $next++]);
                $model->movie()->associate($movie);
            }
            // Схованість і порядок, які задав адміністратор, не чіпаємо.
            $model->fill([...$values, 'missing_since' => null]);
            $model->save();
        }
        if ($complete) {
            $this->retire($movie, $provider, $seen);
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function sourceList(mixed $sources): array
    {
        if (! is_array($sources)) {
            return [];
        }

        $list = [];
        foreach ($sources as $source) {
            if (! is_array($source)) {
                continue;
            }
            $row = [];
            foreach ($source as $key => $value) {
                if (is_string($key)) {
                    $row[$key] = $value;
                }
            }
            $list[] = $row;
        }

        return $list;
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
    public function players(Movie $movie, ?User $user = null): array
    {
        $players = $movie->sources->reject(fn (MovieSource $s) => $s->is_hidden)->map(fn (MovieSource $s) => $s->toPlayer())->values()->all();

        if (! $movie->sources->contains('provider', 'flixcdn') && $link = $this->flixcdn->link($movie)) {
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

        $plugins = app(Plugins::class);
        $prefer = $user instanceof User && $plugins->on('preferred_player') ? (string) $user->pref('cinema_player', '') : '';
        $subs = $user instanceof User && $plugins->on('subtitle_language') ? (string) $user->pref('cinema_subs', '') : '';
        // Порядок і фільтри з адмінки; уподобання глядача (плеєр, субтитри) — важливіші.
        $players = $this->playerRules->apply(array_values($players), fn (array $player): int => $this->providerRank($player, $prefer) * 10 + $this->subtitleRank($player, $subs));

        return $players;
    }

    /**
     * @param  array<string, mixed>  $player
     */
    private function providerRank(array $player, string $prefer): int
    {
        if ($prefer === '') {
            return 0;
        }
        $provider = (string) $player['provider'];
        $link = (string) ($player['link'] ?? '');
        $youtube = $provider === 'custom' && str_contains($link, 'youtube');
        $match = match ($prefer) {
            'youtube' => $youtube,
            'kodik' => $provider === 'kodik',
            'videoseed' => $provider === 'videoseed',
            'flixcdn' => $provider === 'flixcdn',
            default => false,
        };

        return $match ? 0 : 1;
    }

    /**
     * @param  array<string, mixed>  $player
     */
    private function subtitleRank(array $player, string $subs): int
    {
        if ($subs === '') {
            return 1;
        }
        $text = mb_strtolower((string) ($player['translation'] ?? ''));
        $needles = match ($subs) {
            'uk' => ['україн', 'ukrain'],
            'en' => ['english', 'англій', 'оригінал'],
            'ru' => ['рус', 'росі', 'russian'],
            default => [],
        };
        foreach ($needles as $needle) {
            if (str_contains($text, $needle)) {
                return 0;
            }
        }

        return 1;
    }

    /**
     * @return array{status: string|null, rating: int|null, season: int|null, episode: int|null}
     */
    /**
     * @return array{status: string|null, rating: int|null, season: int|null, episode: int|null}
     */
    public function stateFor(Movie $movie, User $user): array
    {
        $row = DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $movie->id)->first(['status', 'rating', 'season', 'episode', 'position', 'player_key']);

        return [
            'status' => $row->status ?? null,
            'rating' => isset($row->rating) ? (int) $row->rating : null,
            'season' => isset($row->season) ? (int) $row->season : null,
            'episode' => isset($row->episode) ? (int) $row->episode : null,
            'position' => isset($row->position) ? (int) $row->position : null,
            'player_key' => $row->player_key ?? null,
        ];
    }

    public function progress(User $user, Movie $movie, ?int $season, int $episode, ?int $position = null, ?string $playerKey = null): void
    {
        $current = DB::table('movie_user')->where('user_id', $user->id)->where('movie_id', $movie->id)->value('status');
        $this->upsert($user, $movie, [
            // Переглянуте чи закинуте не перетворюємо назад на «Дивлюся» від самого прогресу.
            'status' => in_array($current, ['watched', 'dropped'], true) ? $current : 'watching',
            'season' => $season,
            'episode' => $episode,
            'position' => $position,
            'player_key' => $playerKey,
        ]);
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
        if ($rating === null) {
            return;
        }

        $ids = DB::table('rating_follows')->where('author_id', $user->id)->pluck('user_id');
        User::query()->whereIn('id', $ids)->each(function (User $follower) use ($user, $movie, $rating) {
            if ($follower->is($user)) {
                return;
            }
            $follower->notify(new MovieRatingNotice($user, $movie, $rating));
        });
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
