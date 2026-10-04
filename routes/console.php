<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('cinema:sync')->everyFifteenMinutes()->withoutOverlapping(60)->runInBackground();

Schedule::command('servers:sync')->everyTenMinutes()->withoutOverlapping(30)->runInBackground();
Schedule::command('servers:sync --discover --icons')->dailyAt('05:30')->timezone('Europe/Kyiv')->withoutOverlapping(60)->runInBackground();

Schedule::command('families:tick')->everyFifteenMinutes()->withoutOverlapping(30);
Schedule::command('families:tick --digest')->weeklyOn(0, '23:59')->timezone('Europe/Kyiv')->withoutOverlapping(30);

Schedule::command('calls:expire')->everyMinute()->withoutOverlapping(5);
Schedule::command('stories:prune')->hourly()->withoutOverlapping(30);
