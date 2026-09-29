<?php

namespace App\Cinema;

use App\Cinema\Kodik\KodikCatalogSynchronizer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class RunKodikSyncJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;
    public int $backoff = 60;
    public int $uniqueFor = 7200;

    public function __construct(
        public string $mode,
        public int $batch = 100,
        public bool $dryRun = false,
        public ?int $initiatedBy = null,
    ) {}

    public function uniqueId(): string
    {
        return 'kodik:'.$this->mode.':'.($this->dryRun ? 'preview' : 'sync');
    }

    public function handle(KodikCatalogSynchronizer $synchronizer): void
    {
        if ($this->dryRun) {
            $synchronizer->preview($this->batch);

            return;
        }

        $run = $synchronizer->run($this->mode, $this->batch, CinemaSettings::kodikCursor(), 'admin');
        $run->update(['initiated_by' => $this->initiatedBy]);
    }
}
