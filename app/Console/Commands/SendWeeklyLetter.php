<?php

namespace App\Console\Commands;

use App\Services\WeeklyLetter;
use Illuminate\Console\Command;

/** Тижневий лист: події ігор і серверів, на які людина підписана. */
class SendWeeklyLetter extends Command
{
    protected $signature = 'site:weekly';

    protected $description = 'Надіслати тижневий лист про події ігор і серверів';

    public function handle(WeeklyLetter $letter): int
    {
        $this->info('Листів у черзі: '.$letter->sendAll());

        return self::SUCCESS;
    }
}
