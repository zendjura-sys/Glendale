<?php

namespace App\Cinema;

use App\Cinema\Kodik\KodikItemSynchronizer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Throwable;

class RebindKodikTitleJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(public int $runId, public int $titleId, public bool $onlyMissing = true) {}

    public function handle(KodikItemSynchronizer $synchronizer): void
    {
        $run = CinemaSyncRun::find($this->runId);
        $title = Title::find($this->titleId);
        if (! $run || $this->completed()) {
            return;
        }
        if (! $title) {
            $this->finish('skipped');

            return;
        }
        if ($this->onlyMissing && $title->kodikSources()->where('is_available', true)->exists()) {
            $this->finish('skipped');

            return;
        }

        // Provider failures throw before any binding can be removed.
        $items = Kodik::search($title);
        foreach ($items as $item) {
            $synchronizer->sync($item, $run);
        }
        if ($items === []) {
            CinemaSyncEvent::create([
                'run_id' => $run->id, 'title_id' => $title->id,
                'action' => 'lookup', 'status' => 'not_found', 'message' => 'not_found',
            ]);
        }
        $this->finish($items === [] ? 'not_found' : 'processed');
    }

    public function failed(?Throwable $exception): void
    {
        CinemaSyncEvent::create([
            'run_id' => $this->runId, 'title_id' => Title::find($this->titleId)?->id,
            'action' => 'lookup', 'status' => 'failed', 'message' => 'provider_failure',
        ]);
        $this->finish('failed');
    }

    private function finish(string $status): void
    {
        DB::transaction(function () use ($status): void {
            $run = CinemaSyncRun::query()->lockForUpdate()->find($this->runId);
            if (! $run || $this->completed()) {
                return;
            }
            CinemaSyncEvent::create([
                'run_id' => $run->id,
                'title_id' => Title::find($this->titleId)?->id,
                'action' => 'rebind_complete',
                'status' => $status,
                'identifiers' => ['title_id' => $this->titleId],
            ]);
            $counters = $run->counters ?? [];
            $counters['completed'] = ($counters['completed'] ?? 0) + 1;
            $counters[$status] = ($counters[$status] ?? 0) + 1;
            $finished = $counters['completed'] >= ($counters['queued'] ?? 0);
            $run->update([
                'counters' => $counters,
                'status' => $finished ? (empty($counters['failed']) ? 'succeeded' : 'partial') : 'running',
                'finished_at' => $finished ? now() : null,
            ]);
        });
    }

    private function completed(): bool
    {
        return CinemaSyncEvent::query()
            ->where('run_id', $this->runId)
            ->where('action', 'rebind_complete')
            ->where('identifiers->title_id', $this->titleId)
            ->exists();
    }
}
