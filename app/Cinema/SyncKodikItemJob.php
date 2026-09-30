<?php

namespace App\Cinema;

use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\Kodik\KodikRunProgress;
use Illuminate\Support\Facades\DB;
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

        $translation = $this->item['translation']['id'] ?? $this->item['translation_id'] ?? 0;

        return $this->runId.':'.$identity.':'.$translation;
    }

    public function handle(KodikItemSynchronizer $synchronizer): void
    {
        DB::transaction(function () use ($synchronizer): void {
            $run = CinemaSyncRun::query()->lockForUpdate()->find($this->runId);
            if (! $run || KodikRunProgress::completed($run, $this->uniqueId())) {
                return;
            }

            $result = $synchronizer->sync($this->item, $run);
            KodikRunProgress::record($run, $this->uniqueId(), $result->status);
        });
    }

    public function failed(?\Throwable $exception): void
    {
        DB::transaction(function (): void {
            $run = CinemaSyncRun::query()->lockForUpdate()->find($this->runId);
            if ($run && ! KodikRunProgress::completed($run, $this->uniqueId())) {
                KodikRunProgress::record($run, $this->uniqueId(), 'failed');
            }
        });
    }
}

