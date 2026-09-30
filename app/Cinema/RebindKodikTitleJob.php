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
    public int $timeout = 600;
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
        if ($this->onlyMissing && Kodik::hasWorkingPlayer($title)) {
            $this->finish('skipped');

            return;
        }

        // Provider failures throw before any binding can be removed.
        $items = Kodik::search($title);
        DB::transaction(function () use ($items, $synchronizer, $run, $title): void {
            $before = $title->kodikSources()->pluck('id')->all();
            $accepted = [];
            foreach ($items as $item) {
                $result = $synchronizer->sync($item, $run, true);
                if ($result->title?->id === $title->id && in_array($result->status, ['created', 'updated'], true)) {
                    $variants = is_array($item['translations'] ?? null) && array_is_list($item['translations'])
                        ? $item['translations'] : [$item];
                    foreach ($variants as $variant) {
                        $translation = (string) ($variant['translation']['id'] ?? $variant['translation_id'] ?? 0);
                        $kodikId = (string) ($item['kodik_id'] ?? $item['id'] ?? '');
                        $id = $title->kodikSources()->where('kodik_id', $kodikId)
                            ->where('translation_id', $translation)->value('id');
                        if ($id !== null) {
                            $accepted[] = $id;
                        }
                    }
                }
            }
            if (! $this->onlyMissing && in_array($run->mode, ['full', 'rebind_all'], true) && $accepted !== []) {
                $title->kodikSources()->whereIn('id', $before)->whereNotIn('id', $accepted)
                    ->update(['is_available' => false]);
                PlayerSources::refreshKodikAggregate($title);
            }
        });
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

