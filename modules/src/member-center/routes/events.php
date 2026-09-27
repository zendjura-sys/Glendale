<?php

use Addons\MemberCenter\Services\DisciplineService;
use Illuminate\Console\Scheduling\Schedule;

// Строки покарань: прострочені штрафи (×2 + догана) і згорілі зауваження
// та догани — раз на 10 хвилин, той самий прийом реєстрації, що й у Bonuses.
app(Schedule::class)
    ->call(fn () => \App\Families\FamilyContext::eachVerified(fn () => app(DisciplineService::class)->processDeadlines()))
    ->name('member-center-discipline-deadlines')
    ->everyTenMinutes()
    ->withoutOverlapping();
