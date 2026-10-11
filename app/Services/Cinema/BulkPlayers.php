<?php

namespace App\Services\Cinema;

use App\Jobs\AssignCinemaPlayers;
use App\Models\Movie;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Масова проставка плеєрів на всі тайтли (фільми, серіали, аніме…): для кожного тайтлу запитуються
 * озвучки Kodik, Videoseed і FlixCDN. Нові озвучки додаються завжди; наявні плеєри замінюються лише
 * в режимі «Замінювати». На тайтлах жодних позначок — що й де змінено, видно лише у звіті.
 * Працює у фоні частинами (AssignCinemaPlayers), стан і звіт — у налаштуваннях (cinema_bulk).
 */
class BulkPlayers
{
    /** Тайтлів за один прохід черги. */
    public const CHUNK = 25;

    /** Скільки змінених тайтлів зберігати у звіті. */
    public const REPORT_LIMIT = 1000;

    private const KEY = 'cinema_bulk';

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly CinemaService $cinema,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function state(): ?array
    {
        $state = $this->settings->get(self::KEY);

        return is_array($state) ? $state : null;
    }

    /** Йде проставка. Якщо прохід черги впав і стан не оновлювався пів години — вважаємо, що ні. */
    public function running(): bool
    {
        $state = $this->state();
        if (($state['status'] ?? null) !== 'running') {
            return false;
        }
        $updated = Carbon::make($state['updated_at'] ?? null);

        return $updated !== null && $updated->gt(Carbon::now()->subMinutes(30));
    }

    /**
     * @param  list<string>  $providers
     */
    public function start(bool $replace, ?string $type, array $providers): bool
    {
        if ($this->running()) {
            return false;
        }
        $total = $this->query($type)->count();
        $this->save([
            'status' => 'running',
            'replace' => $replace,
            'type' => $type,
            'providers' => $providers,
            'total' => $total,
            'done' => 0,
            'changed' => 0,
            'added' => 0,
            'replaced' => 0,
            'removed' => 0,
            'not_found' => 0,
            'cursor' => 0,
            'errors' => [],
            'report' => [],
            'started_at' => Carbon::now()->toIso8601String(),
            'finished_at' => null,
        ]);
        AssignCinemaPlayers::dispatch();

        return true;
    }

    public function cancel(): void
    {
        $state = $this->state();
        if ($state !== null && ($state['status'] ?? null) === 'running') {
            $this->save([...$state, 'status' => 'cancelled', 'finished_at' => Carbon::now()->toIso8601String()]);
        }
    }

    /**
     * Один прохід: наступні CHUNK тайтлів. true — є ще робота (черга запускає наступний прохід).
     */
    public function step(): bool
    {
        $state = $this->state();
        if ($state === null || $state['status'] !== 'running') {
            return false;
        }
        $movies = $this->query($state['type'] ?? null)
            ->where('id', '>', (int) $state['cursor'])
            ->orderBy('id')
            ->limit(self::CHUNK)
            ->get();

        foreach ($movies as $movie) {
            $this->assign($movie, (bool) $state['replace'], array_values(array_filter((array) $state['providers'], 'is_string')), $state);
            $state['cursor'] = $movie->id;
            $state['done']++;
        }

        // Скасування під час проходу: не затираємо його.
        if (($this->state()['status'] ?? null) !== 'running') {
            return false;
        }
        $more = $movies->count() === self::CHUNK;
        if (! $more) {
            $state['status'] = 'finished';
            $state['finished_at'] = Carbon::now()->toIso8601String();
        }
        $this->save($state);

        return $more;
    }

    /**
     * @param  list<string>  $providers
     * @param  array<string, mixed>  $state
     */
    private function assign(Movie $movie, bool $replace, array $providers, array &$state): void
    {
        try {
            $found = $this->cinema->fetchPlayers($movie, $providers === [] ? null : $providers);
        } catch (Throwable $e) {
            $this->error($state, $movie, $e);

            return;
        }

        $any = false;
        $changes = [];
        foreach ($found as $provider => $sources) {
            if ($sources === null || $sources === []) {
                continue;
            }
            $any = true;
            try {
                $stats = $this->cinema->mergeSources($movie, $provider, $sources, $replace);
            } catch (Throwable $e) {
                $this->error($state, $movie, $e);

                continue;
            }
            $state['added'] += $stats['added'];
            $state['replaced'] += $stats['replaced'];
            $state['removed'] += $stats['removed'];
            if ($stats['added'] + $stats['replaced'] + $stats['removed'] > 0) {
                $changes[$provider] = $stats;
            }
        }

        if (! $any) {
            $state['not_found']++;
        }
        $movie->forceFill(['synced_at' => Carbon::now()])->saveQuietly();
        if ($changes !== []) {
            $state['changed']++;
            $report = (array) ($state['report'] ?? []);
            if (count($report) < self::REPORT_LIMIT) {
                $report[] = [
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'year' => $movie->year,
                    'type' => $movie->type,
                    'providers' => $changes,
                ];
            }
            $state['report'] = $report;
        }
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function error(array &$state, Movie $movie, Throwable $e): void
    {
        Log::warning('Cinema bulk players failed', ['movie' => $movie->id, 'error' => $e->getMessage()]);
        $errors = (array) $state['errors'];
        if (count($errors) < 20) {
            $errors[] = $movie->title.': '.$e->getMessage();
        }
        $state['errors'] = $errors;
    }

    /**
     * @return Builder<Movie>
     */
    private function query(?string $type)
    {
        return Movie::query()->when($type, fn ($q, $t) => $q->where('type', $t));
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function save(array $state): void
    {
        $this->settings->put([self::KEY => [...$state, 'updated_at' => Carbon::now()->toIso8601String()]]);
    }
}
