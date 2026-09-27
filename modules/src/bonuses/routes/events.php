<?php

use Addons\Bonuses\Models\BonusPayout;
use Addons\Bonuses\Services\BonusCalculator;
use Addons\Bonuses\Support\FinanceNotifier;
use Illuminate\Console\Scheduling\Schedule;

// Файл підключається на кожен boot (включно з artisan schedule:run), тому
// реєстрація тут безпечна — той самий приём, що й у Progression.
// Субота 23:00 Europe/Kyiv — рахує щойно завершений тиждень, одразу
// зараховує премії на рахунки учасників (банк).
// Кожна підтверджена родина рахується окремо, у своїх межах (FamilyContext).
app(Schedule::class)
    ->call(fn () => \App\Families\FamilyContext::eachVerified(function () {
        $calculator = app(BonusCalculator::class);
        // Рівно о 23:00 currentWeekStart() — це вже початок НОВОГО тижня
        // (ще порожнього), тож тиждень, що щойно завершився, — на один назад.
        $weekStart = $calculator->currentWeekStart()->subWeek();

        $credited = $calculator->runWeeklyPayouts($weekStart, credit: true);

        $credited->each(fn (BonusPayout $payout) => FinanceNotifier::notify(
            $payout->user,
            'bonus_credited',
            '💰',
            'Премію зараховано',
            '+'.FinanceNotifier::money($payout->total_amount).' на ваш рахунок — премія за тиждень '
                .$weekStart->format('d.m').'–'.$weekStart->copy()->addDays(6)->format('d.m.Y').'.',
        ));
    }))
    ->name('bonuses-weekly-payouts')
    ->weeklyOn(6, '23:00')
    ->timezone('Europe/Kyiv')
    ->withoutOverlapping();
