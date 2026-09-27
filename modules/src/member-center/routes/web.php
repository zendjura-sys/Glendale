<?php

use Addons\MemberCenter\Http\Controllers\DisciplineController;
use Addons\MemberCenter\Http\Controllers\MemberCenterController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'family.member'])->group(function () {
    Route::get('/member-center', [MemberCenterController::class, 'index'])->name('member-center.index');
    Route::post('/member-center/leave', [MemberCenterController::class, 'storeLeave'])->name('member-center.leave.store');
    Route::get('/discipline', [DisciplineController::class, 'index'])->name('discipline.index');
    Route::post('/discipline/{warning}/pay', [DisciplineController::class, 'pay'])->name('discipline.pay');
});
