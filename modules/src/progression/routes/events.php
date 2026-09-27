<?php

use Addons\Progression\Listeners\AwardXpOnReportReviewed;
use Addons\Progression\Listeners\UnlockAchievementOnAccountLinked;
use Addons\Progression\Services\ProgressionService;
use Addons\Reports\Events\ReportReviewed;
use Addons\TelegramBot\Events\AccountLinked;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;

// ::class на несуществующий (если Reports не установлен) класс — это просто
// строковый литерал на этапе компиляции, автозагрузка не триггерится. Если
// Reports неактивен, событие ReportReviewed никогда не диспатчится, и этот
// listener просто никогда не сработает — без ошибок и без жёсткой связи
// между пакетами.
Event::listen(ReportReviewed::class, AwardXpOnReportReviewed::class);

// Той самий принцип для Telegram-бота: якщо він не встановлений, AccountLinked
// просто ніколи не диспатчиться.
Event::listen(AccountLinked::class, UnlockAchievementOnAccountLinked::class);

// Файл подключается на каждый boot (включая artisan schedule:run), поэтому
// регистрация здесь безопасна и не требует отдельного entrypoint-типа.
app(Schedule::class)
    // Кожна підтверджена родина — окремо, у своїх межах (FamilyContext).
    ->call(fn () => \App\Families\FamilyContext::eachVerified(fn () => app(ProgressionService::class)->runWeeklyBonuses()))
    ->weeklyOn(0, '20:00')
    ->timezone('Europe/Kyiv')
    ->name('progression-weekly-bonuses')
    ->withoutOverlapping();
