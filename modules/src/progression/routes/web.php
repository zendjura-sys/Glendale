<?php

use Addons\Progression\Http\Controllers\ProgressController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'family.member'])->group(function () {
    Route::get('/progress', [ProgressController::class, 'index'])->name('progression.index');
    Route::get('/leaderboard', [ProgressController::class, 'leaderboard'])->name('progression.leaderboard');
    Route::get('/hall-of-fame', [ProgressController::class, 'hallOfFame'])->name('progression.hall-of-fame');
});
