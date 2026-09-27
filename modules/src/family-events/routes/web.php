<?php

use Addons\FamilyEvents\Http\Controllers\FamilyEventsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'family.member'])->group(function () {
    Route::get('/events', [FamilyEventsController::class, 'index'])->name('family-events.index');
    Route::post('/events/{event}/rsvp', [FamilyEventsController::class, 'rsvp'])->name('family-events.rsvp');
});
