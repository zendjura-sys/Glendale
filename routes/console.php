<?php

use App\Models\AppLoginRequest;
use App\Models\SpamBlock;
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
// Особиста зведення рахунку в банку сім’ї — у неділю ввечері, поки тиждень ще не закінчився.
Schedule::command('families:bank-digest')->weeklyOn(0, '20:00')->timezone('Europe/Kyiv')->withoutOverlapping(60);
Schedule::command('site:weekly')->weeklyOn(1, '09:00')->timezone('Europe/Kyiv')->withoutOverlapping(60);
// «Кліп тижня» — після опівночі понеділка, коли тиждень закрито.
Schedule::command('moments:clip-of-week')->weeklyOn(1, '10:10')->timezone('Europe/Kyiv')->withoutOverlapping(30);

Schedule::command('calls:expire')->everyMinute()->withoutOverlapping(5);
// «Слухати разом»: кімнати без слухачів 10 хвилин завершуються.
Schedule::command('listen:sweep')->everyMinute()->withoutOverlapping(5);
// Автопости ботів у групах і каналах (розклад за Києвом).
Schedule::command('chat:autopost')->everyMinute()->withoutOverlapping(5);
Schedule::command('tournaments:tick')->everyFiveMinutes()->withoutOverlapping(10);
// Роздачі ігор (GamerPower) — щогодини; знижки на бажане (CheapShark) — кожні 6 год.
Schedule::command('communities:weekly-digest')->weeklyOn(1, '10:05')->timezone('Europe/Kyiv')->withoutOverlapping(60);
Schedule::command('games:giveaways')->hourlyAt(17)->withoutOverlapping(30)->runInBackground();
Schedule::command('games:wishlist-alerts')->cron('40 */6 * * *')->withoutOverlapping(120)->runInBackground();
Schedule::command('digest:morning')->dailyAt('09:00')->timezone('Europe/Kyiv')->withoutOverlapping(60)->runInBackground();

// Білінг: донати Donatello → поповнення; автопродовження GameCon+ з рахунку.
Schedule::command('billing:tick')->hourly()->withoutOverlapping(30);
Schedule::command('posts:publish')->everyMinute()->withoutOverlapping(5);
Schedule::command('messages:tick')->everyMinute()->withoutOverlapping(5);
Schedule::command('events:remind')->everyFiveMinutes()->withoutOverlapping(10);
// Події серверів із Discord — що 15 хвилин, події й виходи ігор з IGDB — щогодини.
Schedule::command('events:sync --servers')->everyFifteenMinutes()->withoutOverlapping(15);
Schedule::command('events:sync --games')->hourlyAt(25)->withoutOverlapping(30);
// «Граю в…»: бот Discord слухає до 55 хв і перезапускається; Steam опитуємо що дві хвилини.
Schedule::command('discord:presence')->everyMinute()->withoutOverlapping(60)->runInBackground();
Schedule::command('steam:presence')->everyTwoMinutes()->withoutOverlapping(5);
// Нові рядки інтерфейсу після оновлень — докладаємо переклади щоночі.
Schedule::command('i18n:translate')->dailyAt('03:20')->timezone('Europe/Kyiv')->withoutOverlapping(120)->runInBackground();
// База «IP → країна» для блокування країн — щотижня.
Schedule::command('geoip:update')->weeklyOn(3, '04:10')->timezone('Europe/Kyiv')->withoutOverlapping(60)->runInBackground();
Schedule::command('stories:prune')->hourly()->withoutOverlapping(30);
// Запити «Увійти через застосунок» старші за 30 днів (до того — для аудиту).
Schedule::command('model:prune', ['--model' => [AppLoginRequest::class, SpamBlock::class]])->dailyAt('04:20')->timezone('Europe/Kyiv')->withoutOverlapping(30);
// Рідкість бейджів («є у 2% людей»).
Schedule::command('achievements:rarity')->dailyAt('05:10')->timezone('Europe/Kyiv')->withoutOverlapping(60)->runInBackground();
Schedule::command('games:sync')->dailyAt('04:40')->timezone('Europe/Kyiv')->withoutOverlapping(120)->runInBackground();

// Ролі Discord за складом груп, де підключено бота GameCon.
Schedule::command('bots:roles')->hourly()->withoutOverlapping(30)->runInBackground();

// «Зараз у стрімі»: Twitch пакетами, YouTube по черзі.
Schedule::command('streams:check')->everyThreeMinutes()->withoutOverlapping(10)->runInBackground();
