<?php

namespace Tests\Feature\Cinema;

use Illuminate\Console\Scheduling\Event;
use Illuminate\Support\Facades\Schedule;
use Tests\TestCase;

class KodikScheduleTest extends TestCase
{
    public function test_kodik_and_existing_cinema_commands_have_safe_schedules(): void
    {
        $events = collect(Schedule::events());

        $incremental = $this->command($events, 'cinema:kodik-sync --mode=incremental');
        $this->assertSame('*/10 * * * *', $incremental->expression);
        $this->assertTrue($incremental->withoutOverlapping);
        $this->assertTrue($incremental->runInBackground);

        $reconcile = $this->command($events, 'cinema:kodik-sync --mode=reconcile');
        $this->assertSame('0 * * * *', $reconcile->expression);
        $this->assertTrue($reconcile->withoutOverlapping);
        $this->assertTrue($reconcile->runInBackground);

        $autoImport = $this->command($events, 'cinema:auto-import');
        $this->assertSame('0 * * * *', $autoImport->expression);
        $this->assertTrue($autoImport->withoutOverlapping);
    }

    /** @param \Illuminate\Support\Collection<int, Event> $events */
    private function command($events, string $needle): Event
    {
        $event = $events->first(fn (Event $event) => str_contains((string) $event->command, $needle));
        $this->assertInstanceOf(Event::class, $event, "Scheduled command [{$needle}] is missing.");

        return $event;
    }
}
