<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Довідник проєктів: сервери RAGE MP-проєктів (назви, адреси, онлайн).
Schedule::command('projects:sync-servers')->everyTenMinutes()->withoutOverlapping()->runInBackground();

// Кінопортал: новинки з TMDB у чергу на імпорт + повторний пошук плеєра
// (Kodik/FlixCDN) для тайтлів, яким досі нічого не підібрали.
Schedule::command('cinema:auto-import')->hourly()->withoutOverlapping()->runInBackground();
