<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Довідник проєктів: сервери RAGE MP-проєктів (назви, адреси, онлайн).
Schedule::command('projects:sync-servers')->everyTenMinutes()->withoutOverlapping()->runInBackground();
