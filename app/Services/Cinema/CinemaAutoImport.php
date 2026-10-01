<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Services\Cinema\Metadata\MetadataEnricher;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Автонаповнення каталогу: свіжі оновлення Kodik і FlixCDN → імпорт/оновлення плеєрів → збагачення метаданими.
 */
class CinemaAutoImport
{
    public const KODIK_TYPES = [
        'foreign-movie' => 'Зарубіжні фільми',
        'russian-movie' => 'Фільми СНД',
        'foreign-serial' => 'Зарубіжні серіали',
        'russian-serial' => 'Серіали СНД',
        'anime' => 'Аніме-фільми',
        'anime-serial' => 'Аніме-серіали',
        'foreign-cartoon' => 'Зарубіжні мультфільми',
        'russian-cartoon' => 'Мультфільми СНД',
        'soviet-cartoon' => 'Радянські мультфільми',
        'cartoon-serial' => 'Мультсеріали',
        'documentary-serial' => 'Документальні серіали',
        'multi-part-film' => 'Багатосерійні фільми',
    ];

    public const INTERVALS = [30, 60, 180, 360, 720, 1440];

    public const DEFAULTS = [
        'enabled' => false,
        'providers' => ['kodik', 'flixcdn'],
        'kodik_types' => [],
        'pages' => 2,
        'interval' => 60,
        'publish' => true,
        'enrich' => true,
        'enrich_limit' => 40,
        'min_year' => null,
        'only_with_ids' => true,
    ];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly CinemaService $cinema,
        private readonly KodikClient $kodik,
        private readonly FlixcdnClient $flixcdn,
        private readonly MetadataEnricher $enricher,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function config(): array
    {
        $saved = $this->settings->get('cinema_auto');

        return array_replace(self::DEFAULTS, is_array($saved) ? $saved : []);
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function save(array $values): void
    {
        $this->settings->put(['cinema_auto' => array_intersect_key(array_replace($this->config(), $values), self::DEFAULTS)]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function lastRun(): ?array
    {
        $last = $this->settings->get('cinema_sync_last');

        return is_array($last) ? $last : null;
    }

    public function due(): bool
    {
        $config = $this->config();
        if (! $config['enabled']) {
            return false;
        }
        $last = $this->lastRun()['finished_at'] ?? null;

        return ! $last || now()->diffInMinutes($last, true) >= (int) $config['interval'] - 1;
    }

    /**
     * @return array<string, mixed>|null null, якщо синхронізація вже виконується
     */
    public function run(string $trigger = 'schedule', bool $enrichOnly = false): ?array
    {
        $lock = Cache::lock('cinema.sync', 1800);
        if (! $lock->get()) {
            return null;
        }

        try {
            return $this->execute($trigger, $enrichOnly);
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function execute(string $trigger, bool $enrichOnly): array
    {
        $config = $this->config();
        $started = now();
        $stats = [
            'trigger' => $trigger,
            'started_at' => $started->toIso8601String(),
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'enriched' => 0,
            'providers' => [],
            'errors' => [],
        ];

        if (! $enrichOnly) {
            $providers = (array) $config['providers'];

            if (in_array('kodik', $providers, true) && $this->kodik->configured()) {
                $this->collect($stats, 'kodik', function () use ($config) {
                    $types = $config['kodik_types'] ? implode(',', (array) $config['kodik_types']) : null;
                    foreach ($this->kodik->updates($types, max(1, min(20, (int) $config['pages']))) as $page) {
                        yield $page;
                    }
                }, $config);
            }

            if (in_array('flixcdn', $providers, true) && $this->flixcdn->updatesTemplate()) {
                $this->collect($stats, 'flixcdn', function () use ($config) {
                    for ($page = 1; $page <= max(1, min(20, (int) $config['pages'])); $page++) {
                        $result = $this->flixcdn->updates($page);
                        yield $result['candidates'];
                        if (! $result['has_more']) {
                            return;
                        }
                    }
                }, $config);
            }
        }

        if ($enrichOnly || $config['enrich']) {
            $stats['enriched'] = $this->enrichPending((int) $config['enrich_limit'], $stats['errors']);
        }

        $stats['finished_at'] = now()->toIso8601String();
        $stats['duration'] = (int) round($started->diffInSeconds(now(), true));
        $stats['errors'] = array_values(array_slice(array_unique($stats['errors']), 0, 10));
        $this->settings->put(['cinema_sync_last' => $stats]);
        Cache::forget('cinema.genres');

        return $stats;
    }

    /**
     * @param  array<string, mixed>  $stats
     * @param  callable(): iterable<list<array<string, mixed>>>  $pages
     * @param  array<string, mixed>  $config
     */
    private function collect(array &$stats, string $provider, callable $pages, array $config): void
    {
        $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];

        try {
            foreach ($pages() as $candidates) {
                foreach ($candidates as $candidate) {
                    $hasId = filled($candidate['kinopoisk_id']) || filled($candidate['imdb_id']) || filled($candidate['shikimori_id']);
                    if (($config['only_with_ids'] && ! $hasId)
                        || ($config['min_year'] && $candidate['year'] && $candidate['year'] < (int) $config['min_year'])
                        || trim((string) $candidate['title']) === '') {
                        $counts['skipped']++;

                        continue;
                    }

                    $movie = $this->cinema->import($candidate, null, $provider, (bool) $config['publish'], false);
                    $counts[$movie === null ? 'skipped' : ($movie->wasRecentlyCreated ? 'created' : 'updated')]++;
                }
            }
        } catch (CinemaException $e) {
            $stats['errors'][] = $e->getMessage();
        } catch (Throwable $e) {
            Log::error('Cinema auto-import failed', ['provider' => $provider, 'exception' => $e]);
            $stats['errors'][] = ucfirst($provider).': '.$e->getMessage();
        }

        $stats['providers'][$provider] = $counts;
        foreach ($counts as $key => $value) {
            $stats[$key] += $value;
        }
    }

    /**
     * @param  list<string>  $errors
     */
    public function enrichPending(int $limit, array &$errors = []): int
    {
        if (! $this->enricher->available()) {
            return 0;
        }

        $count = 0;
        Movie::query()->whereNull('enriched_at')->latest('id')->limit(max(1, min(500, $limit)))->get()
            ->each(function (Movie $movie) use (&$count, &$errors) {
                $result = $this->enricher->enrich($movie);
                array_push($errors, ...$result['errors']);
                $count += $result['providers'] !== [] ? 1 : 0;
            });

        return $count;
    }
}
