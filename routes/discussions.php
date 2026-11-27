<?php

use App\Http\Controllers\DiscussionController;
use Illuminate\Support\Facades\Route;

/*
| «Обговорення» — однакові шляхи на сайті (routes/web.php), у застосунку (/api/v1) і в мосту
| (/api/v1/site): файл підключається в кожну з груп.
*/
Route::prefix('discussions')->middleware('module:discussions')->whereNumber(['discussion', 'reply'])->group(function () {
    Route::get('list', [DiscussionController::class, 'index'])->middleware('throttle:120,1');
    Route::post('/', [DiscussionController::class, 'store'])->middleware('throttle:10,1');
    Route::get('{discussion}', [DiscussionController::class, 'show'])->middleware('throttle:120,1');
    Route::patch('{discussion}', [DiscussionController::class, 'update']);
    Route::delete('{discussion}', [DiscussionController::class, 'destroy']);
    Route::post('{discussion}/replies', [DiscussionController::class, 'reply'])->middleware('throttle:30,1');
    Route::delete('{discussion}/replies/{reply}', [DiscussionController::class, 'destroyReply']);
    Route::post('{discussion}/like', [DiscussionController::class, 'like'])->middleware('throttle:120,1');
    Route::post('{discussion}/replies/{reply}/like', [DiscussionController::class, 'like'])->middleware('throttle:120,1');
    Route::post('{discussion}/moderate', [DiscussionController::class, 'moderate']);
});
