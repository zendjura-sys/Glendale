<?php

use App\Http\Controllers\AppealController;
use App\Http\Controllers\Settings\AccountController;
use App\Http\Controllers\Settings\AppearanceController;
use App\Http\Controllers\Settings\NavigationController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\StreamController;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');

    Route::get('settings/appearance', [AppearanceController::class, 'edit'])->name('appearance.edit');
    Route::put('settings/appearance', [AppearanceController::class, 'update'])->name('appearance.update');
    Route::put('settings/theme', [AppearanceController::class, 'theme'])->name('appearance.theme');
    Route::put('settings/mode', [AppearanceController::class, 'mode'])->name('appearance.mode');

    Route::get('settings/navigation', [NavigationController::class, 'edit'])->name('navigation.edit');
    Route::put('settings/navigation', [NavigationController::class, 'update'])->name('navigation.update');

    Route::get('settings/account', [AccountController::class, 'edit'])->name('account.edit');
    Route::delete('settings/account/sessions/{session}', [AccountController::class, 'revokeSession'])->whereNumber('session')->name('account.sessions.destroy');
    Route::delete('settings/account/tokens/{token}', [AccountController::class, 'revokeToken'])->whereNumber('token')->name('account.tokens.destroy');
    Route::delete('settings/account/sessions', [AccountController::class, 'revokeOthers'])->name('account.sessions.others');
    Route::put('settings/stream', [StreamController::class, 'update'])->middleware('throttle:10,1')->name('stream.update');
    Route::delete('settings/stream', [StreamController::class, 'destroy'])->name('stream.destroy');
    Route::post('settings/stream/live', [StreamController::class, 'live'])->middleware('throttle:20,1')->name('stream.live');
    Route::delete('settings/account/connections/{client}', [AccountController::class, 'disconnect'])->whereNumber('client')->name('account.connections.destroy');
    Route::put('settings/account/profanity', [AccountController::class, 'profanity'])->name('account.profanity');
    Route::get('settings/account/export', [AccountController::class, 'export'])->middleware('throttle:3,60')->name('account.export');
    Route::post('settings/account/freeze', [AccountController::class, 'freeze'])->middleware('throttle:6,1')->name('account.freeze');
    Route::post('settings/account/appeals', [AccountController::class, 'appeal'])->middleware('throttle:5,60')->name('account.appeals.store');
});

// Заблоковані не можуть увійти — оскаржують з пошти й пароля.
Route::middleware(['guest'])->group(function () {
    Route::get('appeal', [AppealController::class, 'create'])->name('appeal.create');
    Route::post('appeal', [AppealController::class, 'store'])->middleware('throttle:5,10')->name('appeal.store');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware(RequirePassword::class)
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

});

Route::get('.well-known/passkey-endpoints', function () {
    return response()->json([
        'enroll' => route('security.edit'),
        'manage' => route('security.edit'),
    ]);
})->name('well-known.passkeys');
