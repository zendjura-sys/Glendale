<?php

namespace App\Jobs;

use App\Services\Cinema\CinemaAutoImport;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncCinemaCatalog implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;

    public int $tries = 1;

    public int $uniqueFor = 1800;

    public function __construct(public readonly bool $enrichOnly = false) {}

    public function handle(CinemaAutoImport $import): void
    {
        $import->run('manual', $this->enrichOnly);
    }
}
