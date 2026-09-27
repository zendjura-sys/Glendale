<?php

use Addons\FamilyEvents\Events\FamilyEventReminder;
use Addons\FamilyEvents\Events\FamilyEventStartingSoon;
use Addons\FamilyEvents\Models\FamilyEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;

// Файл підключається на кожен boot (включно з artisan schedule:run), тому
// реєстрація тут безпечна — той самий приём, що й у Bonuses/Progression.
// Раз на добу перевіряємо, чи є подія, що стартує РІВНО завтра, і шлемо
// нагадування один раз (reminder_sent_at) — без цього прапорця повторний
// прогін крону того самого дня надіслав би нагадування вдруге.
app(Schedule::class)
    ->call(function () {
        $tomorrow = now('Europe/Kyiv')->addDay();

        FamilyEvent::query()
            ->whereNull('reminder_sent_at')
            ->whereDate('starts_at', $tomorrow->toDateString())
            ->each(function (FamilyEvent $event) {
                Event::dispatch(new FamilyEventReminder($event));
                $event->update(['reminder_sent_at' => now()]);
            });
    })
    ->name('family-events-reminders')
    ->dailyAt('10:00')
    ->timezone('Europe/Kyiv')
    ->withoutOverlapping();

// Друге, окреме нагадування — "за 15 хвилин до початку". Ганяється
// щохвилини (мінімальна гранулярність крону), тому вікно [now, now+15хв]
// ловить кожну подію рівно раз завдяки soon_reminder_sent_at — навіть
// якщо прогін випаде трохи раніше чи пізніше самої точки "15 хв до".
app(Schedule::class)
    // Кожна підтверджена родина — окремо (FamilyContext): свої події, свої нагадування.
    ->call(fn () => \App\Families\FamilyContext::eachVerified(function () {
        $now = FamilyEvent::nowAsStored();
        $soon = $now->copy()->addMinutes(15);

        FamilyEvent::query()
            ->whereNull('soon_reminder_sent_at')
            ->where('starts_at', '>=', $now)
            ->where('starts_at', '<=', $soon)
            ->each(function (FamilyEvent $event) {
                Event::dispatch(new FamilyEventStartingSoon($event));
                $event->update(['soon_reminder_sent_at' => now()]);
            });
    }))
    ->name('family-events-starting-soon')
    ->everyMinute()
    ->withoutOverlapping();
