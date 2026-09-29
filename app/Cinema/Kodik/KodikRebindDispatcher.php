<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSyncRun;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\Title;
use Illuminate\Support\Facades\DB;

class KodikRebindDispatcher
{
    public function dispatch(bool $onlyMissing, int $initiatedBy): CinemaSyncRun
    {
        return DB::transaction(function () use ($onlyMissing, $initiatedBy): CinemaSyncRun {
            $query = Title::query()->when($onlyMissing, fn ($q) => $q->whereDoesntHave(
                'kodikSources', fn ($sources) => $sources->where('is_available', true),
            ));
            $run = CinemaSyncRun::create([
                'source' => 'kodik', 'mode' => $onlyMissing ? 'rebind_missing' : 'rebind_all',
                'status' => 'queued', 'initiator' => 'admin',
                'initiated_by' => $initiatedBy, 'started_at' => now(),
                'counters' => ['queued' => 0, 'completed' => 0],
            ]);
            $queued = 0;
            $query->select('id')->chunkById(200, function ($titles) use ($run, $onlyMissing, &$queued): void {
                foreach ($titles as $title) {
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
