<?php

namespace App\Cinema;

use App\Cinema\Kodik\KodikItemSynchronizer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class SyncKodikItemJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;
    public int $backoff = 30;
    public int $uniqueFor = 3600;

    /** @param array<string, mixed> $item */
    public function __construct(public int $runId, public array $item) {}

    public function uniqueId(): string
    {
        $identity = $this->item['id'] ?? $this->item['kodik_id'] ?? hash('sha256', json_encode($this->item));

        return $this->runId.':'.$identity;
    }

    public function handle(KodikItemSynchronizer $synchronizer): void
    {
        $run = CinemaSyncRun::query()->find($this->runId);
        if ($run) {
            $synchronizer->sync($this->item, $run);
        }
    }
}
