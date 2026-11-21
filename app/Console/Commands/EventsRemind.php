<?php

namespace App\Console\Commands;

use App\Services\EventCalendar;
use App\Services\RecurringEvents;
use App\Services\Shifts\ShiftReminders;
use Illuminate\Console\Command;

/** Нагадування за пів години до подій сімей, кланів і серверів і за годину до змін. */
class EventsRemind extends Command
{
    protected $signature = 'events:remind';

    protected $description = 'Нагадати про події, що починаються найближчим часом';

    public function handle(EventCalendar $calendar, RecurringEvents $repeats, ShiftReminders $shifts): int
    {
        $this->info('Нагадано про подій: '.$calendar->remind());
        $this->info('Наступних повторів: '.$repeats->spawn());
        $this->info('Нагадано про змін: '.$shifts->remind());

        return self::SUCCESS;
    }
}
