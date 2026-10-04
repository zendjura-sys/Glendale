<?php

namespace App\Console\Commands;

use App\Services\EventCalendar;
use Illuminate\Console\Command;

/** Нагадування за пів години до подій сімей, кланів і серверів. */
class EventsRemind extends Command
{
    protected $signature = 'events:remind';

    protected $description = 'Нагадати про події, що починаються найближчим часом';

    public function handle(EventCalendar $calendar): int
    {
        $this->info('Нагадано про подій: '.$calendar->remind());

        return self::SUCCESS;
    }
}
