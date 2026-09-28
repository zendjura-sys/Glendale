<?php

use App\Http\Controllers\Api\FlixyBridgeController;
use App\Http\Middleware\FlixyApiKey;
use Illuminate\Support\Facades\Route;

/**
 * Міст для CineCon (переробленого Flixy) — ті самі шляхи, що очікує
 * нативний застосунок (mobile-flixy/app/.../retrofit/RetrofitService.java),
 * підключені до /api/flixy/ (див. routes/api.php). Захищено тим самим
 * заголовком apikey, що й оригінальний Flixy-бекенд.
 */
Route::middleware(FlixyApiKey::class)->group(function () {
    $c = FlixyBridgeController::class;
    Route::post('fetchSettings', [$c, 'fetchSettings']);
    Route::post('fetchHomePageData', [$c, 'fetchHomePageData']);
    Route::post('fetchContentsByGenre', [$c, 'fetchContentsByGenre']);
    Route::post('fetchContentDetails', [$c, 'fetchContentDetails']);
    Route::post('searchContent', [$c, 'searchContent']);
});
