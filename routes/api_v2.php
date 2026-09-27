<?php

use App\Http\Controllers\Api\V2\ConfigController;
use App\Http\Controllers\Api\V2\FamilyController;
use App\Http\Controllers\Api\V2\UnionController;
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

Route::middleware(['auth:sanctum', 'throttle:240,1,api-v2'])->group(function () {
    Route::post('/auth/logout', function (\Illuminate\Http\Request $request) {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    });

    Route::get('/announcements', [ConfigController::class, 'announcements']);

    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me', [MeController::class, 'update']);
    Route::get('/counters', [MeController::class, 'counters']);
    Route::post('/me/active-family', [MeController::class, 'activeFamily']);
    Route::post('/me/password', [MeController::class, 'password'])->middleware('throttle:6,1,me-password');
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
        Route::post('/posts', [PostController::class, 'store'])->middleware('throttle:30,1,post-create');
        Route::get('/posts/{id}', [PostController::class, 'show']);
        Route::delete('/posts/{id}', [PostController::class, 'destroy']);
        Route::post('/posts/{id}/like', [PostController::class, 'like']);
        Route::delete('/posts/{id}/like', [PostController::class, 'unlike']);
        Route::get('/posts/{id}/likes', [PostController::class, 'likes']);
        Route::post('/posts/{id}/repost', [PostController::class, 'repost']);
        Route::get('/posts/{id}/comments', [PostController::class, 'comments']);
        Route::post('/posts/{id}/comments', [PostController::class, 'comment'])->middleware('throttle:60,1,comment');
        Route::delete('/comments/{id}', [PostController::class, 'destroyComment']);

        Route::get('/groups', [GroupController::class, 'index']);
        Route::post('/groups', [GroupController::class, 'store'])->middleware('throttle:10,1,group-create');
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

        Route::post('/photos', [MiscController::class, 'uploadPhotos'])->middleware('throttle:20,1,photo-upload');
        Route::delete('/photos/{id}', [MiscController::class, 'destroyPhoto']);
        Route::get('/notifications', [MiscController::class, 'notifications']);
        Route::post('/notifications/read', [MiscController::class, 'readNotifications']);
        Route::get('/search', [MiscController::class, 'search']);
        Route::post('/reports', [MiscController::class, 'report'])->middleware('throttle:20,1,report');

        // Система управління родинами («Моя родина»).
        Route::get('/families', [FamilyController::class, 'index']);
        Route::get('/families/mine', [FamilyController::class, 'mine']);
        Route::get('/families/projects', [FamilyController::class, 'projects']);
        Route::post('/families', [FamilyController::class, 'store'])->middleware('throttle:5,1,family-create');
        Route::get('/families/{id}', [FamilyController::class, 'show']);
        Route::patch('/families/{id}', [FamilyController::class, 'update']);
        Route::delete('/families/{id}', [FamilyController::class, 'destroy']);
        Route::post('/families/{id}/{kind}', [FamilyController::class, 'image'])->whereIn('kind', ['avatar', 'cover', 'proof']);
        Route::post('/families/{id}/resubmit', [FamilyController::class, 'resubmit']);
        Route::post('/families/{id}/join', [FamilyController::class, 'join'])->middleware('throttle:10,1,family-join');
        Route::delete('/families/{id}/join', [FamilyController::class, 'leave']);
        Route::get('/families/{id}/requests', [FamilyController::class, 'requests']);
        Route::post('/families/{id}/requests/{userId}', [FamilyController::class, 'approve']);
        Route::delete('/families/{id}/requests/{userId}', [FamilyController::class, 'decline']);
        Route::get('/families/{id}/members', [FamilyController::class, 'members']);
        Route::patch('/families/{id}/members/{userId}', [FamilyController::class, 'setRole']);
        Route::delete('/families/{id}/members/{userId}', [FamilyController::class, 'kick']);

        // Союзи родин.
        Route::get('/unions', [UnionController::class, 'index']);
        Route::post('/unions', [UnionController::class, 'store'])->middleware('throttle:5,1,union-create');
        Route::get('/unions/{id}', [UnionController::class, 'show']);
        Route::patch('/unions/{id}', [UnionController::class, 'update']);
        Route::delete('/unions/{id}', [UnionController::class, 'destroy']);
        Route::post('/unions/{id}/join', [UnionController::class, 'join']);
        Route::delete('/unions/{id}/join', [UnionController::class, 'leave']);
        Route::get('/unions/{id}/requests', [UnionController::class, 'requests']);
        Route::post('/unions/{id}/requests/{familyId}', [UnionController::class, 'approve'])->whereNumber('familyId');
        Route::delete('/unions/{id}/requests/{familyId}', [UnionController::class, 'decline'])->whereNumber('familyId');
        Route::delete('/unions/{id}/families/{familyId}', [UnionController::class, 'kick'])->whereNumber('familyId');
    });
});

// Невідомий метод API — JSON, а не HTML-сторінка 404.
Route::any('/{any}', fn () => response()->json(['error' => 'Метод не знайдено'], 404))->where('any', '.*');
