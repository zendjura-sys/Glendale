<?php

namespace App\Services\Status;

use App\Models\StatusIncident;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Стан складників GameCon для сторінки статусу: база, кеш, черга фонових задач, файли.
 * Перевірки легкі й кешуються на хвилину, щоб сторінку не можна було використати для навантаження.
 */
class HealthChecks
{
    /** Скільки задач у черзі вважається затримкою. */
    public const QUEUE_BACKLOG = 500;

    /** Скільки збоїв задач за годину — погіршення. */
    public const FAILED_PER_HOUR = 20;

    /**
     * @return list<array{key: string, status: string, latency_ms: int|null}>
     */
    public function components(): array
    {
        return Cache::remember('status:components', 60, fn () => [
            ['key' => 'site', 'status' => 'operational', 'latency_ms' => null],
            $this->database(),
            $this->cache(),
            $this->queue(),
            $this->storage(),
        ]);
    }

    /** Загальний стан: найгірший серед складників і активних інцидентів. */
    public function overall(): string
    {
        $statuses = array_column($this->components(), 'status');
        $major = StatusIncident::query()->where('status', '!=', 'resolved')->where('severity', 'major')->exists();
        $minor = StatusIncident::query()->where('status', '!=', 'resolved')->exists();

        return match (true) {
            in_array('down', $statuses, true) || $major => 'down',
            in_array('degraded', $statuses, true) || $minor => 'degraded',
            default => 'operational',
        };
    }

    /** @return array{key: string, status: string, latency_ms: int|null} */
    private function database(): array
    {
        return $this->timed('database', function () {
            DB::select('select 1');

            return 'operational';
        });
    }

    /** @return array{key: string, status: string, latency_ms: int|null} */
    private function cache(): array
    {
        return $this->timed('cache', function () {
            Cache::put('status:ping', 'pong', 30);

            return Cache::get('status:ping') === 'pong' ? 'operational' : 'degraded';
        });
    }

    /** @return array{key: string, status: string, latency_ms: int|null} */
    private function queue(): array
    {
        return $this->timed('queue', function () {
            if (config('queue.default') !== 'database' || ! Schema::hasTable('jobs')) {
                return 'operational';
            }
            $waiting = DB::table('jobs')->count();
            $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->where('failed_at', '>=', now()->subHour())->count() : 0;

            return $waiting > self::QUEUE_BACKLOG || $failed > self::FAILED_PER_HOUR ? 'degraded' : 'operational';
        });
    }

    /** @return array{key: string, status: string, latency_ms: int|null} */
    private function storage(): array
    {
        return $this->timed('storage', function () {
            $disk = Storage::disk('public');
            $disk->put('.status-probe', (string) time());

            return $disk->exists('.status-probe') ? 'operational' : 'degraded';
        });
    }

    /**
     * @param  callable(): string  $check
     * @return array{key: string, status: string, latency_ms: int|null}
     */
    private function timed(string $key, callable $check): array
    {
        $start = hrtime(true);
        try {
            $status = $check();
        } catch (Throwable) {
            $status = 'down';
        }

        return ['key' => $key, 'status' => $status, 'latency_ms' => (int) round((hrtime(true) - $start) / 1e6)];
    }
}
