<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Services\Cinema\Metadata\MetadataEnricher;
use App\Services\Cinema\Metadata\TmdbProvider;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * Автопарсинг TMDB, керований з адмінки:
 *  — які поля TMDB заповнює і чи перезаписує наявні;
 *  — повторне оновлення старих тайтлів (рейтинги, постери, описи);
 *  — автододавання популярних і нових тайтлів зі списків TMDB, якщо для них є плеєр
 *    (Videoseed шукає за ID TMDB, Kodik — за IMDb).
 */
class TmdbAutoParse
{
    /** Поля, які TMDB уміє заповнювати. ID і рейтинг TMDB записуються завжди. */
    public const FIELDS = [
        'title' => 'Назва українською',
        'description' => 'Опис',
        'tagline' => 'Слоган',
        'genres' => 'Жанри',
        'poster_url' => 'Постер',
        'backdrop_url' => 'Фон',
        'trailer_url' => 'Трейлер',
        'age_rating' => 'Вікове обмеження',
        'duration' => 'Тривалість',
        'year' => 'Рік',
        'episodes_count' => 'Кількість серій',
    ];

    public const LIST_LABELS = [
        'trending_day' => 'Тренди дня',
        'trending_week' => 'Тренди тижня',
        'popular_movie' => 'Популярні фільми',
        'popular_tv' => 'Популярні серіали',
        'now_playing' => 'Зараз у кіно',
        'on_the_air' => 'Серіали в ефірі',
        'top_rated_movie' => 'Найкращі фільми',
        'top_rated_tv' => 'Найкращі серіали',
    ];

    public const DEFAULTS = [
        'enabled' => true,
        'fields' => ['title', 'description', 'tagline', 'genres', 'poster_url', 'backdrop_url', 'trailer_url', 'age_rating', 'duration', 'year', 'episodes_count'],
        // prefer — TMDB має пріоритет для вибраних полів; fill — лише порожні поля.
        'mode' => 'prefer',
        // Оновлювати тайтли, яким більше N днів (0 — ні).
        'refresh_days' => 0,
        'discover' => false,
        'lists' => ['trending_week', 'popular_movie', 'popular_tv'],
        'pages' => 1,
        'discover_limit' => 20,
        'min_votes' => 50,
        'min_year' => null,
        'publish' => true,
        // Пошук у кінотеці нічого не знайшов — шукати в TMDB і додавати знайдене (з плеєром) до каталогу.
        'search_import' => true,
    ];

    /** Скільки результатів TMDB перевіряти за один пошук. */
    public const SEARCH_LIMIT = 4;

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly TmdbProvider $tmdb,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function config(): array
    {
        $saved = $this->settings->get('cinema_tmdb');
        $config = array_replace(self::DEFAULTS, is_array($saved) ? array_intersect_key($saved, self::DEFAULTS) : []);
        $config['fields'] = array_values(array_intersect((array) $config['fields'], array_keys(self::FIELDS)));
        $config['lists'] = array_values(array_intersect((array) $config['lists'], array_keys(self::LIST_LABELS)));

        return $config;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function save(array $values): void
    {
        $this->settings->put(['cinema_tmdb' => array_intersect_key(array_replace($this->config(), $values), self::DEFAULTS)]);
    }

    /**
     * Чи може TMDB змінити поле (для MetadataEnricher).
     */
    public function allows(string $field): bool
    {
        $config = $this->config();
        if (! $config['enabled']) {
            return false;
        }

        return ! array_key_exists($field, self::FIELDS) || in_array($field, $config['fields'], true);
    }

    public function fillOnly(): bool
    {
        return $this->config()['mode'] === 'fill';
    }

    /**
     * Тайтли, які пора оновити (enriched_at старший за refresh_days).
     *
     * @return Builder<Movie>|null
     */
    public function staleQuery(): ?Builder
    {
        $days = (int) $this->config()['refresh_days'];

        return $days > 0 ? Movie::query()->where('enriched_at', '<', now()->subDays($days))->oldest('enriched_at') : null;
    }

    /**
     * Додає тайтли зі списків TMDB, для яких є плеєр.
     *
     * @param  array<string, mixed>  $stats
     */
    public function discover(array &$stats, CinemaService $cinema, VideoseedClient $videoseed, KodikClient $kodik, MetadataEnricher $enricher): void
    {
        $config = $this->config();
        $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];
        if (! $config['discover'] || ! $this->tmdb->configured() || (! $videoseed->configured() && ! $kodik->configured())) {
            return;
        }

        $budget = max(1, min(100, (int) $config['discover_limit']));
        try {
            foreach ($config['lists'] as $list) {
                for ($page = 1; $page <= max(1, min(5, (int) $config['pages'])); $page++) {
                    foreach ($this->tmdb->discover($list, $page) as $row) {
                        if ($budget <= 0) {
                            break 3;
                        }
                        if ($row['votes'] < (int) $config['min_votes'] || ($config['min_year'] && $row['year'] && $row['year'] < (int) $config['min_year'])) {
                            $counts['skipped']++;

                            continue;
                        }
                        $tmdbId = $row['kind'].':'.$row['id'];
                        if (Movie::withTrashed()->where('tmdb_id', $tmdbId)->exists()) {
                            continue;
                        }
                        $budget--;

                        $result = $this->importOne($row, $tmdbId, $cinema, $videoseed, $kodik, (bool) $config['publish']);
                        if ($result === null) {
                            $counts['skipped']++;

                            continue;
                        }
                        $counts[$result->wasRecentlyCreated ? 'created' : 'updated']++;
                        $enricher->enrich($result);
                    }
                }
            }
        } catch (CinemaException $e) {
            $stats['errors'][] = $e->getMessage();
        } catch (Throwable $e) {
            report($e);
            $stats['errors'][] = 'TMDB: '.$e->getMessage();
        }

        $stats['providers']['tmdb'] = $counts;
        foreach ($counts as $key => $value) {
            $stats[$key] += $value;
        }
    }

    /**
     * Пошук у каталозі порожній: шукаємо назву в TMDB, а знайдене, для чого є плеєр Videoseed чи Kodik,
     * додаємо до каталогу (опублікованим) і збагачуємо метаданими. Повертає опубліковані тайтли —
     * і щойно додані, і ті, що вже були в каталозі під іншою назвою. Той самий запит — раз на добу.
     *
     * @return list<Movie>
     */
    public function searchImport(string $query, CinemaService $cinema, VideoseedClient $videoseed, KodikClient $kodik, MetadataEnricher $enricher): array
    {
        $query = trim($query);
        if (! $this->config()['search_import'] || mb_strlen($query) < 2 || ! $this->tmdb->configured() || (! $videoseed->configured() && ! $kodik->configured())) {
            return [];
        }

        $key = 'cinema.tmdb_search.'.md5(Str::lower($query));
        $ids = Cache::get($key);
        if (! is_array($ids)) {
            $ids = [];
            try {
                foreach (array_slice($this->tmdb->search($query), 0, self::SEARCH_LIMIT) as $row) {
                    $tmdbId = $row['kind'].':'.$row['id'];
                    $existing = Movie::withTrashed()->where('tmdb_id', $tmdbId)->first();
                    if ($existing !== null) {
                        $ids[] = $existing->id;

                        continue;
                    }
                    $movie = $this->importOne($row, $tmdbId, $cinema, $videoseed, $kodik, true);
                    if ($movie !== null) {
                        $enricher->enrich($movie);
                        $ids[] = $movie->id;
                    }
                }
            } catch (Throwable $e) {
                report($e);

                return [];
            }
            Cache::put($key, $ids, now()->addDay());
        }

        return array_values(Movie::query()->published()->whereIn('id', $ids)->get()->sortBy(fn (Movie $m) => array_search($m->id, $ids, true))->all());
    }

    /**
     * @param  array{kind: string, id: string, title: string, year: int|null}  $row
     */
    private function importOne(array $row, string $tmdbId, CinemaService $cinema, VideoseedClient $videoseed, KodikClient $kodik, bool $publish): ?Movie
    {
        $imdb = null;
        $candidate = null;
        $provider = null;

        if ($videoseed->configured()) {
            $candidate = collect($videoseed->search(['tmdb_id' => $tmdbId]))->first(fn (array $c) => ($c['sources'] ?? []) !== []);
            $provider = 'videoseed';
        }
        if ($candidate === null && $kodik->configured()) {
            $imdb = $this->tmdb->imdbId($row['kind'], $row['id']);
            $candidate = $imdb ? collect($kodik->search(['imdb_id' => $imdb]))->first(fn (array $c) => ($c['sources'] ?? []) !== []) : null;
            $provider = 'kodik';
        }
        if ($candidate === null || $provider === null) {
            return null;
        }

        $candidate['tmdb_id'] = $tmdbId;
        $candidate['imdb_id'] ??= $imdb;
        $movie = $cinema->import($candidate, null, $provider, $publish, false);
        if ($movie !== null && blank($movie->tmdb_id)) {
            $movie->forceFill(['tmdb_id' => $tmdbId])->saveQuietly();
        }

        return $movie;
    }
}
