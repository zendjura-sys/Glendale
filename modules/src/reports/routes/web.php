<?php

use Addons\Reports\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// Этот файл require'ится AddonServiceProvider на каждый HTTP-запрос, пока
// модуль активен, — определяем маршруты сразу с нужным middleware, без
// внешней обёртки.
Route::middleware(['web', 'auth', 'family.member'])->prefix('reports')->name('reports.')->group(function () {
    Route::get('/', [ReportController::class, 'index'])->name('index');
    Route::post('/', [ReportController::class, 'store'])->name('store');
    Route::get('/schedule', [ReportController::class, 'schedule'])->name('schedule');
    Route::get('/members/search', [ReportController::class, 'searchMembers'])->name('members.search');
});
