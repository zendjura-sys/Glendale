<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatApiController;
use App\Http\Controllers\Api\FeedApiController;
use App\Http\Controllers\Api\GroupsApiController;
use App\Http\Controllers\Api\MediaApiController;
use App\Http\Controllers\Api\SocialApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->middleware('throttle:20,1')->group(function () {
        Route::post('login', [AuthController::class, 'login']);
        Route::post('register', [AuthController::class, 'register']);
        Route::post('google', [AuthController::class, 'google']);
        Route::post('discord', [AuthController::class, 'discordStart']);
        Route::post('exchange', [AuthController::class, 'exchange']);
        Route::post('two-factor', [AuthController::class, 'twoFactor']);
    });

    Route::middleware(['auth.api', 'verified.site'])->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::patch('me', [SocialApiController::class, 'updateProfile']);
        Route::put('me/password', [SocialApiController::class, 'password']);
        Route::get('me/connections', [SocialApiController::class, 'connections']);
        Route::delete('me/connections/{provider}', [SocialApiController::class, 'unlink'])->whereIn('provider', ['discord', 'google']);

        Route::get('notifications', [SocialApiController::class, 'notifications']);
        Route::post('notifications/read', [SocialApiController::class, 'readNotifications']);
        Route::get('search', [SocialApiController::class, 'search'])->middleware('throttle:60,1');

        Route::middleware('module:feed')->group(function () {
            Route::get('feed', [FeedApiController::class, 'index']);
            Route::post('posts', [FeedApiController::class, 'store'])->middleware('throttle:30,1');
            Route::get('posts/{post}', [FeedApiController::class, 'show'])->whereNumber('post');
            Route::delete('posts/{post}', [FeedApiController::class, 'destroy'])->whereNumber('post');
            Route::post('posts/{post}/like', [FeedApiController::class, 'like'])->whereNumber('post')->middleware('throttle:120,1');
            Route::get('posts/{post}/comments', [FeedApiController::class, 'comments'])->whereNumber('post');
            Route::post('posts/{post}/comments', [FeedApiController::class, 'comment'])->whereNumber('post')->middleware('throttle:30,1');
        });

        Route::middleware('module:friends')->group(function () {
            Route::get('friends', [SocialApiController::class, 'friends']);
            Route::post('friends/{user}', [SocialApiController::class, 'requestFriend'])->middleware('throttle:60,1');
            Route::post('friends/{user}/accept', [SocialApiController::class, 'acceptFriend']);
            Route::delete('friends/{user}', [SocialApiController::class, 'removeFriend']);
        });

        Route::get('people', [SocialApiController::class, 'people'])->middleware('module:people');
        Route::get('users/{user}', [SocialApiController::class, 'profile']);

        Route::prefix('messages')->middleware('module:messages')->group(function () {
            Route::get('/', [ChatApiController::class, 'index']);
            Route::get('contacts', [ChatApiController::class, 'contacts']);
            Route::get('stickers', [ChatApiController::class, 'stickers']);
            Route::post('groups', [ChatApiController::class, 'group'])->middleware('throttle:10,1');
            Route::post('with/{user}', [ChatApiController::class, 'direct']);
            Route::get('attachments/{attachment}', [ChatApiController::class, 'download'])->whereNumber('attachment');
            Route::get('{conversation}', [ChatApiController::class, 'show'])->whereNumber('conversation');
            Route::get('{conversation}/history', [ChatApiController::class, 'history'])->whereNumber('conversation');
            Route::post('{conversation}', [ChatApiController::class, 'send'])->whereNumber('conversation')->middleware('throttle:60,1');
            Route::post('{conversation}/read', [ChatApiController::class, 'read'])->whereNumber('conversation');
            Route::post('{conversation}/mute', [ChatApiController::class, 'mute'])->whereNumber('conversation');
        });

        Route::middleware('module:communities')->group(function () {
            Route::get('communities', [GroupsApiController::class, 'communities']);
            Route::post('communities', [GroupsApiController::class, 'storeCommunity'])->middleware('throttle:10,1');
            Route::get('communities/{community}', [GroupsApiController::class, 'community']);
            Route::post('communities/{community}/join', [GroupsApiController::class, 'joinCommunity']);
            Route::delete('communities/{community}/join', [GroupsApiController::class, 'leaveCommunity']);
        });

        Route::middleware('module:photos')->group(function () {
            Route::get('users/{user}/photos', [MediaApiController::class, 'photos']);
            Route::post('albums', [MediaApiController::class, 'storeAlbum'])->middleware('throttle:20,1');
            Route::get('albums/{album}', [MediaApiController::class, 'album'])->whereNumber('album');
            Route::post('albums/{album}/photos', [MediaApiController::class, 'uploadPhotos'])->whereNumber('album')->middleware('throttle:20,1');
            Route::get('photos/{photo}', [MediaApiController::class, 'photo'])->whereNumber('photo');
            Route::post('photos/{photo}/like', [MediaApiController::class, 'likePhoto'])->whereNumber('photo');
        });

        Route::prefix('music')->middleware('module:music')->group(function () {
            Route::get('/', [MediaApiController::class, 'music']);
            Route::post('tracks', [MediaApiController::class, 'storeTrack'])->middleware('throttle:10,1');
            Route::post('playlists', [MediaApiController::class, 'storePlaylist'])->middleware('throttle:20,1');
            Route::post('now-playing', [MediaApiController::class, 'nowPlaying'])->middleware('throttle:60,1');
            Route::post('spotify/connect', [MediaApiController::class, 'spotifyStart']);
            Route::delete('spotify', [MediaApiController::class, 'spotifyDisconnect']);
            Route::get('spotify/{section}', [MediaApiController::class, 'spotifyLibrary']);
            Route::post('tracks/{track}/library', [MediaApiController::class, 'addTrack'])->whereNumber('track');
            Route::delete('tracks/{track}/library', [MediaApiController::class, 'removeTrack'])->whereNumber('track');
            Route::get('playlists/{playlist}', [MediaApiController::class, 'playlist'])->whereNumber('playlist');
        });

        Route::prefix('cinema')->middleware('module:cinema')->group(function () {
            Route::get('/', [MediaApiController::class, 'cinema']);
            Route::get('{movie}', [MediaApiController::class, 'movie']);
            Route::post('{movie}/status', [MediaApiController::class, 'movieStatus']);
            Route::post('{movie}/rate', [MediaApiController::class, 'movieRate']);
        });

        Route::prefix('servers')->middleware('module:servers')->group(function () {
            Route::get('/', [GroupsApiController::class, 'servers']);
            Route::post('/', [GroupsApiController::class, 'suggestServer'])->middleware('throttle:10,1');
            Route::get('{server}', [GroupsApiController::class, 'server']);
        });

        Route::middleware('module:families')->group(function () {
            Route::get('families', [GroupsApiController::class, 'families']);
            Route::get('families/{family}', [GroupsApiController::class, 'family']);
            Route::post('families/{family}/apply', [GroupsApiController::class, 'applyFamily'])->middleware('throttle:10,1');
            Route::get('families/{family}/members', [GroupsApiController::class, 'members']);
            Route::get('families/{family}/bank', [GroupsApiController::class, 'bank']);
            Route::post('families/{family}/cashouts', [GroupsApiController::class, 'requestCashout'])->middleware('throttle:20,1');
            Route::post('families/{family}/deposits', [GroupsApiController::class, 'openDeposit'])->middleware('throttle:20,1');
            Route::post('families/{family}/bank/manual', [GroupsApiController::class, 'manualBank'])->middleware('throttle:30,1');
            Route::get('families/{family}/warehouse', [GroupsApiController::class, 'warehouse']);
            Route::get('families/{family}/discipline', [GroupsApiController::class, 'discipline']);
            Route::post('families/{family}/discipline', [GroupsApiController::class, 'issuePunishment'])->middleware('throttle:30,1');
            Route::get('families/{family}/events', [GroupsApiController::class, 'events']);
            Route::get('families/{family}/rating', [GroupsApiController::class, 'rating']);
            Route::get('families/{family}/settings', [GroupsApiController::class, 'settings']);
            Route::patch('families/{family}/settings/profile', [GroupsApiController::class, 'updateProfile']);
            Route::put('families/{family}/settings', [GroupsApiController::class, 'updateSettings']);
            Route::get('families/{family}/reports', [GroupsApiController::class, 'reports']);
            Route::post('families/{family}/reports', [GroupsApiController::class, 'storeReport'])->middleware('throttle:20,1');
            Route::get('families/{family}/queue', [GroupsApiController::class, 'queue']);
            Route::post('families/{family}/reports/{report}/review', [GroupsApiController::class, 'reviewReport'])->whereNumber('report');
            Route::get('families/{family}/proofs/{proof}', [GroupsApiController::class, 'proof'])->whereNumber('proof');
            Route::get('families/{family}/audit', [GroupsApiController::class, 'audit']);
        });
    });
});
