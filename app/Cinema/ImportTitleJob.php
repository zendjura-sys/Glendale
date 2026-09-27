<?php

namespace App\Cinema;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Масовий імпорт (популярне, топ) — у черзі, по тайтлу на задачу. */
class ImportTitleJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public string $type, public int $tmdbId) {}

    public function handle(): void
    {
        Importer::import($this->type, $this->tmdbId);
    }
}
