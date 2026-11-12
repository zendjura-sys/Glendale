<?php

namespace App\Console\Commands;

use App\Services\WeeklyDigest;
use Illuminate\Console\Command;

/** Щотижневий дайджест у неділю ввечері за Києвом. */
class DigestWeekly extends Command
{
    protected $signature = 'digest:weekly';

    protected $description = 'Надіслати щотижневий дайджест';

    public function handle(WeeklyDigest $digest): int
    {
        $this->info('Надіслано дайджестів: '.$digest->sendAll());

        return self::SUCCESS;
    }
}
