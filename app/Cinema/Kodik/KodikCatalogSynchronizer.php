<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\SyncKodikItemJob;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

final class KodikCatalogSynchronizer
{
    private const MAX_PAGES_PER_RUN = 10000;

    public function __construct(private readonly KodikClient $client) {}

    public function run(
        string $mode,
        int $batch,
        ?string $cursor = null,
        string $initiator = 'scheduler',
    ): CinemaSyncRun {
        if (! in_array($mode, ['incremental', 'missing', 'reconcile', 'full'], true) || $batch < 1 || $batch > 100) {
            throw new \InvalidArgumentException('Invalid Kodik mode or page size.');
        }
        $this->guardAgainstOverlap($mode);
        if ($mode !== 'incremental') {
            return app(KodikRebindDispatcher::class)->dispatch($mode === 'missing', null, $mode, $initiator);
        }

        $run = CinemaSyncRun::create([
            'source' => 'kodik',
            'mode' => $mode,
            'status' => 'running',
            'initiator' => $initiator,
            'cursor_before' => $cursor,
            'cursor_after' => $cursor,
            'counters' => ['pages' => 0, 'seen' => 0, 'queued' => 0, 'completed' => 0, 'catalog_complete' => false],
            'started_at' => now(),
        ]);

        $counters = $run->counters;
        $requestCursor = $cursor;
        $visitedCursors = [];
        $queuedKeys = [];

        try {
            do {
                if ($counters['pages'] >= self::MAX_PAGES_PER_RUN) {
                    throw new RuntimeException('Kodik pagination exceeded the safety limit.');
                }

                $cursorKey = $requestCursor ?? '__first__';
                if (isset($visitedCursors[$cursorKey])) {
                    throw new RuntimeException('Kodik pagination returned a repeated cursor.');
                }
                $visitedCursors[$cursorKey] = true;

                $page = $this->client->list($this->query($batch, $requestCursor));
                $jobs = [];
                foreach ($page->results as $item) {
                    $job = new SyncKodikItemJob($run->id, $item);
                    if (! isset($queuedKeys[$job->uniqueId()])) {
                        $queuedKeys[$job->uniqueId()] = true;
                        $jobs[] = $job;
                    }
                }

                DB::transaction(function () use ($run, $page, $jobs): void {
                    $locked = CinemaSyncRun::query()->lockForUpdate()->findOrFail($run->id);
                    $counts = $locked->counters;
                    $counts['pages']++;
                    $counts['seen'] += count($page->results);
                    $counts['queued'] += count($jobs);
                    $locked->update(['cursor_after' => $page->nextPage, 'counters' => $counts]);
                    CinemaSettings::setKodikCursor($page->nextPage);
                    foreach ($jobs as $job) {
                        SyncKodikItemJob::dispatch($job->runId, $job->item)->afterCommit();
                    }
                });
                $counters = $run->fresh()->counters;

                $requestCursor = $page->nextPage;
            } while ($requestCursor !== null);

            DB::transaction(function () use ($run): void {
                $locked = CinemaSyncRun::query()->lockForUpdate()->findOrFail($run->id);
                $counts = $locked->counters;
                $counts['catalog_complete'] = true;
                $locked->counters = $counts;
                KodikRunProgress::finishIfReady($locked);
                $locked->save();
            });

            return $run->fresh();
        } catch (Throwable $exception) {
            $run->update([
                'status' => $counters['seen'] > 0 ? 'partial' : 'failed',
                'error_summary' => $this->safeErrorSummary($exception),
                'finished_at' => now(),
            ]);

            throw $exception;
        }
    }

    public function preview(int $batch, ?string $cursor = null): KodikPage
    {
        return $this->client->list($this->query($batch, $cursor));
    }

    /** @return array<string, int|string> */
    private function query(int $batch, ?string $cursor): array
    {
        $query = [
            'limit' => $batch,
            'with_material_data' => 'true',
            'with_episodes_data' => 'true',
        ];

        if ($cursor === null || $cursor === '') {
            return $query;
        }

        if (filter_var($cursor, FILTER_VALIDATE_URL)) {
            parse_str((string) parse_url($cursor, PHP_URL_QUERY), $cursorQuery);
            unset($cursorQuery['token']);

            foreach ($cursorQuery as $key => $value) {
                if (is_scalar($value)) {
                    $query[(string) $key] = (string) $value;
                }
            }

            return $query;
        }

        $query['next'] = $cursor;

        return $query;
    }

    private function guardAgainstOverlap(string $mode): void
    {
        $running = CinemaSyncRun::query()
            ->where('source', 'kodik')
            ->where('mode', $mode)
            ->whereIn('status', ['queued', 'running'])
            ->where('started_at', '>=', now()->subHours(2))
            ->exists();

        if ($running) {
            throw new RuntimeException("Kodik sync for mode {$mode} is already running.");
        }
    }

    private function safeErrorSummary(Throwable $exception): string
    {
        if ($exception instanceof KodikApiException) {
            return 'Kodik API failure: '.$exception->kind();
        }

        return 'Kodik synchronization failed: '.$exception::class;
    }
}

