<?php

namespace App\Jobs;

use App\Services\Cinema\BulkPlayers;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Масова проставка плеєрів: один прохід (BulkPlayers::CHUNK тайтлів), потім наступний. */
class AssignCinemaPlayers implements ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public int $tries = 1;

    public function handle(BulkPlayers $bulk): void
    {
        if ($bulk->step()) {
            // Коротка пауза між проходами, щоб не впертися в ліміти API провайдерів.
            self::dispatch()->delay(now()->addSeconds(3));
        }
    }
}
