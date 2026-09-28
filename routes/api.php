<?php

use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AppConfigController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceTokenController;
use App\Http\Controllers\Api\GalleryController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\RulesController;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;

/**
 * API для мобільного застосунку (Flutter) — токени Sanctum, без сесії й
 * CSRF. Веб і адмінка й далі йдуть через routes/web.php з сесіями, цей
 * файл існує лише для мобільного клієнта.
 */
Route::get('/app-config', [AppConfigController::class, 'show']);
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/two-factor', [AuthController::class, 'loginTwoFactor']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/gallery', [GalleryController::class, 'index']);
    Route::get('/rules', [RulesController::class, 'json']);
    Route::post('/device-tokens', [DeviceTokenController::class, 'store']);
    Route::delete('/device-tokens', [DeviceTokenController::class, 'destroy']);
    // Heartbeat онлайн-статусу — саму мітку ставить TrackLastSeen.
    Route::post('/presence/ping', fn () => response()->noContent());

    // Мінімальна нативна адмінка (лише ядро, без аддон-специфічних дій) —
    // доступ гейтиться в самому контролері (users.manage / будь-який *.manage).
    Route::get('/admin/stats', [AdminController::class, 'stats']);
    Route::get('/admin/users', [AdminController::class, 'users']);
    Route::get('/admin/users/options', [AdminController::class, 'userOptions']);
});

// Профіль учасника (свій чи чужий) — окрема група лише заради
// SubstituteBindings ({user} інакше мовчки підставляє порожню модель).
Route::middleware(['auth:sanctum', SubstituteBindings::class])->group(function () {
    Route::get('/users/{user}', [UserProfileController::class, 'show']);
});

// Керування конкретним учасником (редагування, ролі, посада, скидання
// пароля, видалення) — ті самі методи Admin\UserController, що вже
// віддають чистий JSON для веб-адмінки (Admin/Users), напряму. Окрема
// група потрібна лише заради SubstituteBindings: без нього {user}
// мовчки підставляє порожню модель замість реальної з БД.
Route::middleware(['auth:sanctum', SubstituteBindings::class, 'permission:users.manage'])->group(function () {
    Route::put('/admin/users/{user}', [AdminUserController::class, 'update']);
    Route::put('/admin/users/{user}/roles', [AdminUserController::class, 'updateRoles']);
    Route::put('/admin/users/{user}/position', [AdminUserController::class, 'updatePosition']);
    Route::post('/admin/users/{user}/reset-password', [AdminUserController::class, 'resetPassword']);
    Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
});

// API платформи (соцмережа, родини, кіно) — спільний для SPA і застосунку.
Route::prefix('v2')->group(base_path('routes/api_v2.php'));

// Міст для нативного CineCon (переробленого Flixy) — окремий apikey-контур,
// без Sanctum (застосунок про нього не знає), див. routes/flixy_api.php.
Route::prefix('flixy')->group(base_path('routes/flixy_api.php'));
