<?php

namespace App\Console\Commands;

use App\Services\EventCalendar;
use App\Services\RecurringEvents;
use Illuminate\Console\Command;

/** Нагадування за пів години до подій сімей, кланів і серверів. */
class EventsRemind extends Command
{
    protected $signature = 'events:remind';

    protected $description = 'Нагадати про події, що починаються найближчим часом';

    public function handle(EventCalendar $calendar, RecurringEvents $repeats): int
    {
        $this->info('Нагадано про подій: '.$calendar->remind());
        $this->info('Наступних повторів: '.$repeats->spawn());

        return self::SUCCESS;
    }
}
