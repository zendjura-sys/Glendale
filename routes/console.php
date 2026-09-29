<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Довідник проєктів: сервери RAGE MP-проєктів (назви, адреси, онлайн).
Schedule::command('projects:sync-servers')->everyTenMinutes()->withoutOverlapping()->runInBackground();

// Kodik: швидке підхоплення оновлень та щогодинна звірка каталогу.
// Окремі mutex не дозволяють наступному запуску накластися на попередній.
Schedule::command('cinema:kodik-sync --mode=incremental')->everyTenMinutes()->withoutOverlapping(20)->runInBackground();
Schedule::command('cinema:kodik-sync --mode=reconcile')->hourly()->withoutOverlapping(90)->runInBackground();

// Кінопортал: новинки з TMDB у чергу на імпорт + повторний пошук плеєра
// (Kodik/FlixCDN) для тайтлів, яким досі нічого не підібрали.
Schedule::command('cinema:auto-import')->hourly()->withoutOverlapping()->runInBackground();
