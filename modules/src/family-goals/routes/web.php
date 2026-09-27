<?php

use Addons\FamilyGoals\Http\Controllers\FamilyGoalsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'family.member'])->group(function () {
    Route::get('/family', [FamilyGoalsController::class, 'index'])->name('family-goals.index');
});
