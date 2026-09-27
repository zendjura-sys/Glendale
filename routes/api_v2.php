<?php

use App\Http\Controllers\Api\V2\ConfigController;
use App\Http\Controllers\Api\V2\GroupController;
use App\Http\Controllers\Api\V2\MeController;
use App\Http\Controllers\Api\V2\MiscController;
use App\Http\Controllers\Api\V2\PeopleController;
use App\Http\Controllers\Api\V2\PostController;
use Illuminate\Support\Facades\Route;

/*
| API платформи v2 (/api/v2/...) — спільний для веб-SPA (resources/app) і
| Flutter-застосунку. Автентифікація — токен Sanctum (Bearer), без кук і
| CSRF. Контракт відповідей — resources/app/lib/types.ts.
*/

Route::get('/config', [ConfigController::class, 'config']);

Route::middleware(['auth:sanctum', 'throttle:240,1'])->group(function () {
    Route::post('/auth/logout', function (\Illuminate\Http\Request $request) {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    });

    Route::get('/announcements', [ConfigController::class, 'announcements']);

    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me', [MeController::class, 'update']);
    Route::get('/counters', [MeController::class, 'counters']);
    Route::post('/me/password', [MeController::class, 'password'])->middleware('throttle:6,1');
    Route::post('/me/avatar', [MeController::class, 'avatar']);
    Route::post('/me/cover', [MeController::class, 'cover']);

    Route::whereNumber(['id', 'userId'])->group(function () {
        Route::get('/users/{id}', [PeopleController::class, 'show']);
        Route::get('/users/{id}/friends', [PeopleController::class, 'friends']);
        Route::get('/users/{id}/groups', [PeopleController::class, 'groups']);
        Route::get('/users/{id}/photos', [PeopleController::class, 'photos']);
        // Spotify ще не підключено до платформи — «зараз слухає» порожнє.
        Route::get('/users/{id}/spotify-now', fn () => response()->json(null));

        Route::get('/friends/requests', [PeopleController::class, 'requests']);
        Route::get('/friends/suggestions', [PeopleController::class, 'suggestions']);
        Route::post('/friends/{id}', [PeopleController::class, 'add']);
        Route::delete('/friends/{id}', [PeopleController::class, 'remove']);

        Route::get('/wall/{type}/{id}', [PostController::class, 'wall'])->whereIn('type', ['user', 'group']);
        Route::get('/feed', [PostController::class, 'feed']);
        Route::post('/posts', [PostController::class, 'store'])->middleware('throttle:30,1');
        Route::get('/posts/{id}', [PostController::class, 'show']);
        Route::delete('/posts/{id}', [PostController::class, 'destroy']);
        Route::post('/posts/{id}/like', [PostController::class, 'like']);
        Route::delete('/posts/{id}/like', [PostController::class, 'unlike']);
        Route::get('/posts/{id}/likes', [PostController::class, 'likes']);
        Route::post('/posts/{id}/repost', [PostController::class, 'repost']);
        Route::get('/posts/{id}/comments', [PostController::class, 'comments']);
        Route::post('/posts/{id}/comments', [PostController::class, 'comment'])->middleware('throttle:60,1');
        Route::delete('/comments/{id}', [PostController::class, 'destroyComment']);

        Route::get('/groups', [GroupController::class, 'index']);
        Route::post('/groups', [GroupController::class, 'store'])->middleware('throttle:10,1');
        Route::get('/groups/{id}', [GroupController::class, 'show']);
        Route::patch('/groups/{id}', [GroupController::class, 'update']);
        Route::delete('/groups/{id}', [GroupController::class, 'destroy']);
        Route::post('/groups/{id}/{kind}', [GroupController::class, 'image'])->whereIn('kind', ['avatar', 'cover']);
        Route::post('/groups/{id}/join', [GroupController::class, 'join']);
        Route::delete('/groups/{id}/join', [GroupController::class, 'leave']);
        Route::get('/groups/{id}/requests', [GroupController::class, 'requests']);
        Route::post('/groups/{id}/requests/{userId}', [GroupController::class, 'approve']);
        Route::delete('/groups/{id}/requests/{userId}', [GroupController::class, 'decline']);
        Route::get('/groups/{id}/members', [GroupController::class, 'members']);
        Route::patch('/groups/{id}/members/{userId}', [GroupController::class, 'setRole']);
        Route::delete('/groups/{id}/members/{userId}', [GroupController::class, 'kick']);

        Route::post('/photos', [MiscController::class, 'uploadPhotos'])->middleware('throttle:20,1');
        Route::delete('/photos/{id}', [MiscController::class, 'destroyPhoto']);
        Route::get('/notifications', [MiscController::class, 'notifications']);
        Route::post('/notifications/read', [MiscController::class, 'readNotifications']);
        Route::get('/search', [MiscController::class, 'search']);
        Route::post('/reports', [MiscController::class, 'report'])->middleware('throttle:20,1');
    });
});

// Невідомий метод API — JSON, а не HTML-сторінка 404.
Route::any('/{any}', fn () => response()->json(['error' => 'Метод не знайдено'], 404))->where('any', '.*');
