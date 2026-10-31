<?php

namespace App\Console\Commands;

use App\Services\MorningDigest;
use Illuminate\Console\Command;

/** Ранковий дайджест о 9:00 за Києвом. */
class DigestMorning extends Command
{
    protected $signature = 'digest:morning';

    protected $description = 'Надіслати ранковий дайджест';

    public function handle(MorningDigest $digest): int
    {
        $this->info('Надіслано дайджестів: '.$digest->sendAll());

        return self::SUCCESS;
    }
}
