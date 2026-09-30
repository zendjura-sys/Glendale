<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\Title;
use Illuminate\Support\Facades\DB;

class KodikRebindDispatcher
{
    public function dispatch(bool $onlyMissing, ?int $initiatedBy, ?string $mode = null, string $initiator = 'admin'): CinemaSyncRun
    {
        return DB::transaction(function () use ($onlyMissing, $initiatedBy, $mode, $initiator): CinemaSyncRun {
            $query = Title::query()->with('kodikSources');
            if ($mode === 'reconcile') {
                $query->where(function ($q): void {
                    $q->where('kodik_sync_status', 'failed')
                        ->orWhereNull('kodik_checked_at')
                        ->orWhere('kodik_checked_at', '<', now()->subDay())
                        ->orWhere('type', 'series');
                });
            }
            $run = CinemaSyncRun::create([
                'source' => 'kodik', 'mode' => $mode ?? ($onlyMissing ? 'rebind_missing' : 'rebind_all'),
                'status' => 'queued', 'initiator' => $initiator,
                'initiated_by' => $initiatedBy, 'started_at' => now(),
                'counters' => ['queued' => 0, 'completed' => 0],
            ]);
            $queued = 0;
            $query->chunkById(200, function ($titles) use ($run, $onlyMissing, &$queued): void {
                foreach ($titles as $title) {
                    if ($onlyMissing && Kodik::hasWorkingPlayer($title)) {
                        continue;
                    }
                    RebindKodikTitleJob::dispatch($run->id, $title->id, $onlyMissing)->afterCommit();
                    $queued++;
                }
            });
            $run->update([
                'counters' => ['queued' => $queued, 'completed' => 0],
                'status' => $queued ? 'queued' : 'succeeded',
                'finished_at' => $queued ? null : now(),
            ]);

            return $run;
        });
    }
}

