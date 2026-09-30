<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSyncEvent;
use App\Cinema\CinemaSyncRun;

final class KodikRunProgress
{
    public static function completed(CinemaSyncRun $run, string $key): bool
    {
        return CinemaSyncEvent::query()->where('run_id', $run->id)
            ->where('action', 'item_complete')->where('identifiers->job_key', $key)->exists();
    }

    /** Call while holding the run row lock. */
    public static function record(CinemaSyncRun $run, string $key, string $status): void
    {
        CinemaSyncEvent::create([
            'run_id' => $run->id, 'action' => 'item_complete', 'status' => $status,
            'identifiers' => ['job_key' => $key],
            'message' => $status === 'failed' ? 'Kodik item processing failed.' : null,
        ]);
        $counters = $run->counters ?? [];
        $counters['completed'] = ($counters['completed'] ?? 0) + 1;
        $counters[$status] = ($counters[$status] ?? 0) + 1;
        $run->counters = $counters;
        self::finishIfReady($run);
        $run->save();
    }

    public static function finishIfReady(CinemaSyncRun $run): void
    {
        $counters = $run->counters ?? [];
        if (($counters['catalog_complete'] ?? false)
            && ($counters['completed'] ?? 0) >= ($counters['queued'] ?? 0)
            && $run->status === 'running') {
            $run->status = ($counters['failed'] ?? 0) > 0 ? 'partial' : 'succeeded';
            $run->finished_at = now();
        }
    }
}

