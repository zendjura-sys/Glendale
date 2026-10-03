<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\CinemaController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\CommunityMemberController;
use App\Http\Controllers\Families;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\Mail\UnsubscribeController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\MusicController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NowPlayingController;
use App\Http\Controllers\PeopleController;
use App\Http\Controllers\PhotoAlbumController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ServerController;
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\VoiceController;
use App\Http\Controllers\WelcomeController;
use App\Models\VoiceRoom;
use Illuminate\Support\Facades\Route;

Route::get('/', WelcomeController::class)->name('home');

Route::redirect('dashboard', '/feed')->name('dashboard');

Route::prefix('auth')->name('auth.')->group(function () {
    Route::get('discord', [SocialAuthController::class, 'discordRedirect'])->middleware('throttle:20,1')->name('discord');
    Route::get('discord/callback', [SocialAuthController::class, 'discordCallback'])->middleware('throttle:20,1')->name('discord.callback');
    Route::post('firebase', [SocialAuthController::class, 'firebase'])->middleware('throttle:20,1')->name('firebase');
    Route::delete('social/{provider}', [SocialAuthController::class, 'unlink'])->middleware('auth')->whereIn('provider', ['discord', 'google'])->name('social.unlink');
});

Route::middleware(['auth', 'verified.site'])->group(function () {
    Route::get('feed', [FeedController::class, 'index'])->middleware('module:feed')->name('feed');

    Route::post('posts', [PostController::class, 'store'])->middleware('throttle:30,1')->name('posts.store');
    Route::get('posts/{post}', [PostController::class, 'show'])->name('posts.show');
    Route::delete('posts/{post}', [PostController::class, 'destroy'])->name('posts.destroy');
    Route::post('posts/{post}/pin', [PostController::class, 'pin'])->name('posts.pin');
    Route::post('posts/{post}/like', [PostController::class, 'like'])->middleware('throttle:120,1')->name('posts.like');

    Route::get('posts/{post}/comments', [CommentController::class, 'index'])->name('comments.index');
    Route::post('posts/{post}/comments', [CommentController::class, 'store'])->middleware('throttle:30,1')->name('comments.store');
    Route::delete('comments/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');
    Route::post('comments/{comment}/like', [CommentController::class, 'like'])->middleware('throttle:120,1')->name('comments.like');

    Route::middleware('module:friends')->group(function () {
        Route::get('friends', [FriendController::class, 'index'])->name('friends.index');
        Route::post('friends/{user}', [FriendController::class, 'store'])->middleware('throttle:60,1')->name('friends.store');
        Route::post('friends/{user}/accept', [FriendController::class, 'accept'])->name('friends.accept');
        Route::delete('friends/{user}', [FriendController::class, 'destroy'])->name('friends.destroy');
    });

    // Голосові кімнати сімей і спільнот (звук — через LiveKit).
    Route::prefix('voice')->name('voice.')->group(function () {
        Route::get('{type}/{id}', [VoiceController::class, 'index'])->whereIn('type', VoiceRoom::OWNERS)->whereNumber('id')->name('index');
        Route::post('{type}/{id}', [VoiceController::class, 'store'])->whereIn('type', VoiceRoom::OWNERS)->whereNumber('id')->middleware('throttle:20,1')->name('store');
        Route::patch('rooms/{room}', [VoiceController::class, 'update'])->whereNumber('room')->name('update');
        Route::delete('rooms/{room}', [VoiceController::class, 'destroy'])->whereNumber('room')->name('destroy');
        Route::post('rooms/{room}/join', [VoiceController::class, 'join'])->whereNumber('room')->middleware('throttle:30,1')->name('join');
        Route::post('rooms/{room}/members/{user:id}', [VoiceController::class, 'moderate'])->whereNumber(['room', 'user'])->name('moderate');
    });

    Route::prefix('messages')->name('messages.')->middleware('module:messages')->group(function () {
        Route::get('/', [MessengerController::class, 'index'])->name('index');
        Route::get('contacts', [MessengerController::class, 'contacts'])->name('contacts');
        Route::get('stickers', [MessageController::class, 'stickers'])->name('stickers');
        Route::get('attachments/{attachment}', [MessageController::class, 'download'])->whereNumber('attachment')->name('attachments.download');
        Route::get('with/{user}', [MessengerController::class, 'direct'])->name('direct');
        Route::post('groups', [MessengerController::class, 'storeGroup'])->middleware('throttle:10,1')->name('groups.store');

        Route::whereNumber(['conversation', 'message'])->group(function () {
            Route::get('{conversation}', [MessengerController::class, 'show'])->name('show');
            Route::get('{conversation}/history', [MessengerController::class, 'history'])->name('history');
            Route::post('{conversation}', [MessageController::class, 'store'])->middleware('throttle:60,1')->name('store');
            Route::post('{conversation}/settings', [MessengerController::class, 'update'])->name('update');
            Route::post('{conversation}/read', [MessengerController::class, 'read'])->name('read');
            Route::post('{conversation}/mute', [MessengerController::class, 'mute'])->name('mute');
            Route::post('{conversation}/members', [MessengerController::class, 'addMembers'])->name('members.store');
            Route::delete('{conversation}/members/{user}', [MessengerController::class, 'removeMember'])->name('members.destroy');
            Route::patch('{conversation}/messages/{message}', [MessageController::class, 'update'])->name('messages.update');
            Route::delete('{conversation}/messages/{message}', [MessageController::class, 'destroy'])->name('messages.destroy');
        });
    });

    Route::middleware('module:communities')->group(function () {
        Route::get('communities', [CommunityController::class, 'index'])->name('communities.index');
        Route::post('communities', [CommunityController::class, 'store'])->middleware('throttle:10,1')->name('communities.store');

        Route::prefix('c/{community}')->name('communities.')->group(function () {
            Route::get('/', [CommunityController::class, 'show'])->name('show');
            Route::delete('/', [CommunityController::class, 'destroy'])->name('destroy');
            Route::get('settings', [CommunityController::class, 'edit'])->name('edit');
            Route::patch('settings', [CommunityController::class, 'update'])->name('update');
            Route::post('images/{field}', [CommunityController::class, 'updateImage'])->whereIn('field', ['avatar', 'cover'])->name('image');
            Route::post('join', [CommunityController::class, 'join'])->middleware('throttle:60,1')->name('join');
            Route::delete('join', [CommunityController::class, 'leave'])->name('leave');

            Route::get('photos', [PhotoController::class, 'community'])->middleware('module:photos')->name('photos');
            Route::get('members', [CommunityMemberController::class, 'index'])->name('members');
            Route::post('members/{user}/approve', [CommunityMemberController::class, 'approve'])->name('members.approve');
            Route::delete('members/{user}/request', [CommunityMemberController::class, 'decline'])->name('members.decline');
            Route::patch('members/{user}', [CommunityMemberController::class, 'role'])->name('members.role');
            Route::delete('members/{user}', [CommunityMemberController::class, 'destroy'])->name('members.destroy');
        });
    });

    Route::middleware('module:photos')->group(function () {
        Route::get('photos', [PhotoController::class, 'index'])->name('photos.index');
        Route::get('photos/u/{user}', [PhotoController::class, 'user'])->name('photos.user');
        Route::post('albums', [PhotoAlbumController::class, 'store'])->middleware('throttle:20,1')->name('albums.store');

        Route::whereNumber(['album', 'photo'])->group(function () {
            Route::get('albums/{album}', [PhotoAlbumController::class, 'show'])->name('albums.show');
            Route::patch('albums/{album}', [PhotoAlbumController::class, 'update'])->name('albums.update');
            Route::delete('albums/{album}', [PhotoAlbumController::class, 'destroy'])->name('albums.destroy');
            Route::post('albums/{album}/photos', [PhotoAlbumController::class, 'upload'])->middleware('throttle:30,1')->name('albums.upload');

            Route::get('photos/{photo}', [PhotoController::class, 'show'])->name('photos.show');
            Route::patch('photos/{photo}', [PhotoController::class, 'update'])->name('photos.update');
            Route::delete('photos/{photo}', [PhotoController::class, 'destroy'])->name('photos.destroy');
            Route::post('photos/{photo}/cover', [PhotoController::class, 'cover'])->name('photos.cover');
            Route::post('photos/{photo}/like', [PhotoController::class, 'like'])->middleware('throttle:120,1')->name('photos.like');
            Route::get('photos/{photo}/comments', [PhotoController::class, 'comments'])->name('photos.comments.index');
            Route::post('photos/{photo}/comments', [PhotoController::class, 'comment'])->middleware('throttle:30,1')->name('photos.comments.store');
        });
    });

    Route::prefix('music')->middleware('module:music')->group(function () {
        Route::get('/', [MusicController::class, 'index'])->name('music.index');
        Route::get('u/{user}', [MusicController::class, 'user'])->name('music.user');
        Route::get('search', [MusicController::class, 'search'])->middleware('throttle:120,1')->name('music.search');
        Route::post('now-playing', [NowPlayingController::class, 'store'])->middleware('throttle:60,1')->name('music.now-playing');
        Route::delete('now-playing', [NowPlayingController::class, 'destroy'])->name('music.now-playing.destroy');

        Route::post('tracks', [TrackController::class, 'store'])->middleware('throttle:60,1')->name('tracks.store');
        Route::post('playlists', [PlaylistController::class, 'store'])->middleware('throttle:20,1')->name('playlists.store');

        Route::whereNumber(['track', 'playlist'])->group(function () {
            Route::patch('tracks/{track}', [TrackController::class, 'update'])->name('tracks.update');
            Route::delete('tracks/{track}', [TrackController::class, 'destroy'])->name('tracks.destroy');
            Route::get('tracks/{track}/download', [TrackController::class, 'download'])->name('tracks.download');
            Route::post('tracks/{track}/library', [TrackController::class, 'add'])->name('tracks.add');
            Route::delete('tracks/{track}/library', [TrackController::class, 'remove'])->name('tracks.remove');

            Route::get('playlists/{playlist}', [PlaylistController::class, 'show'])->name('playlists.show');
            Route::post('playlists/{playlist}', [PlaylistController::class, 'update'])->name('playlists.update');
            Route::delete('playlists/{playlist}', [PlaylistController::class, 'destroy'])->name('playlists.destroy');
            Route::post('playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'attach'])->name('playlists.attach');
            Route::delete('playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'detach'])->name('playlists.detach');
        });

        Route::prefix('spotify')->name('spotify.')->group(function () {
            Route::get('connect', [SpotifyController::class, 'connect'])->name('connect');
            Route::patch('/', [SpotifyController::class, 'update'])->name('update');
            Route::delete('/', [SpotifyController::class, 'disconnect'])->name('disconnect');
            Route::middleware('throttle:120,1')->group(function () {
                Route::get('token', [SpotifyController::class, 'token'])->name('token');
                Route::get('search', [SpotifyController::class, 'search'])->name('search');
                Route::get('library/{section}', [SpotifyController::class, 'library'])->name('library');
                Route::get('playlists/{playlist}', [SpotifyController::class, 'playlist'])->name('playlist');
                Route::put('play', [SpotifyController::class, 'play'])->name('play');
            });
        });
    });

    Route::prefix('cinema')->name('cinema.')->middleware('module:cinema')->group(function () {
        Route::get('/', [CinemaController::class, 'index'])->name('index');
        Route::get('my', [CinemaController::class, 'my'])->name('my');
        Route::get('search', [CinemaController::class, 'search'])->middleware('throttle:120,1')->name('search');
        Route::get('{movie}', [CinemaController::class, 'show'])->name('show');
        Route::patch('{movie}/status', [CinemaController::class, 'status'])->middleware('throttle:60,1')->name('status');
        Route::put('{movie}/rating', [CinemaController::class, 'rate'])->middleware('throttle:60,1')->name('rate');
        Route::post('{movie}/started', [CinemaController::class, 'started'])->middleware('throttle:30,1')->name('started');
        Route::get('{movie}/comments', [CinemaController::class, 'comments'])->name('comments.index');
        Route::post('{movie}/comments', [CinemaController::class, 'comment'])->middleware('throttle:30,1')->name('comments.store');
    });

    Route::prefix('servers')->name('servers.')->middleware('module:servers')->group(function () {
        Route::get('/', [ServerController::class, 'index'])->name('index');
        Route::post('suggest', [ServerController::class, 'suggest'])->middleware('throttle:5,10')->name('suggest');
        Route::get('{server}', [ServerController::class, 'show'])->name('show');
    });

    Route::middleware('module:families')->group(function () {
        Route::get('families', [Families\FamilyController::class, 'index'])->name('families.index');
        Route::get('families/create', [Families\FamilyController::class, 'create'])->name('families.create');
        Route::post('families', [Families\FamilyController::class, 'store'])->middleware('throttle:5,10')->name('families.store');

        Route::prefix('f/{family}')->name('families.')->scopeBindings()->group(function () {
            Route::get('/', [Families\FamilyController::class, 'show'])->name('show');
            Route::post('apply', [Families\FamilyController::class, 'apply'])->middleware('throttle:10,10')->name('apply');
            Route::delete('apply', [Families\FamilyController::class, 'withdraw'])->name('withdraw');
            Route::post('leave', [Families\FamilyController::class, 'leave'])->name('leave');
            Route::get('chat', [Families\FamilyController::class, 'chat'])->name('chat');

            Route::get('reports', [Families\FamilyReportController::class, 'index'])->name('reports');
            Route::post('reports', [Families\FamilyReportController::class, 'store'])->middleware('throttle:30,1')->name('reports.store');
            Route::get('queue', [Families\FamilyReportController::class, 'queue'])->name('queue');
            Route::post('reports/bulk', [Families\FamilyReportController::class, 'bulk'])->name('reports.bulk');
            Route::post('reports/{report}/review', [Families\FamilyReportController::class, 'review'])->whereNumber('report')->name('reports.review');
            Route::get('proofs/{proof}', [Families\FamilyReportController::class, 'proof'])->whereNumber('proof')->name('proofs.show');

            Route::get('bank', [Families\FamilyBankController::class, 'index'])->name('bank');
            Route::post('bank/cashouts', [Families\FamilyBankController::class, 'requestCashout'])->middleware('throttle:10,1')->name('cashouts.store');
            Route::post('bank/cashouts/{cashout}/pay', [Families\FamilyBankController::class, 'payCashout'])->whereNumber('cashout')->name('cashouts.pay');
            Route::post('bank/cashouts/{cashout}/cancel', [Families\FamilyBankController::class, 'cancelCashout'])->whereNumber('cashout')->name('cashouts.cancel');
            Route::get('bank/cashouts/{cashout}/proof', [Families\FamilyBankController::class, 'cashoutProof'])->whereNumber('cashout')->name('cashouts.proof');
            Route::post('bank/deposits', [Families\FamilyBankController::class, 'openDeposit'])->middleware('throttle:10,1')->name('deposits.store');
            Route::post('bank/deposits/{deposit}/close', [Families\FamilyBankController::class, 'closeDeposit'])->whereNumber('deposit')->name('deposits.close');
            Route::post('bank/manual', [Families\FamilyBankController::class, 'manual'])->middleware('throttle:30,1')->name('bank.manual');

            Route::get('warehouse', [Families\FamilyWarehouseController::class, 'index'])->name('warehouse');
            Route::post('warehouse/move', [Families\FamilyWarehouseController::class, 'move'])->middleware('throttle:60,1')->name('warehouse.move');
            Route::post('warehouse/items', [Families\FamilyWarehouseController::class, 'storeItem'])->name('warehouse.items.store');
            Route::patch('warehouse/items/{item}', [Families\FamilyWarehouseController::class, 'updateItem'])->whereNumber('item')->name('warehouse.items.update');
            Route::get('warehouse/logs/{log}/proof', [Families\FamilyWarehouseController::class, 'proof'])->whereNumber('log')->name('warehouse.proof');

            Route::get('members', [Families\FamilyMemberController::class, 'index'])->name('members');
            Route::put('ranks', [Families\FamilyMemberController::class, 'ranks'])->name('ranks.update');
            Route::whereNumber('member')->group(function () {
                Route::post('members/{member}/accept', [Families\FamilyMemberController::class, 'accept'])->name('members.accept');
                Route::post('members/{member}/decline', [Families\FamilyMemberController::class, 'decline'])->name('members.decline');
                Route::patch('members/{member}', [Families\FamilyMemberController::class, 'update'])->name('members.update');
                Route::post('members/{member}/kick', [Families\FamilyMemberController::class, 'kick'])->name('members.kick');
                Route::post('members/{member}/transfer', [Families\FamilyMemberController::class, 'transfer'])->name('members.transfer');
            });

            Route::get('discipline', [Families\FamilyDisciplineController::class, 'index'])->name('discipline');
            Route::post('discipline', [Families\FamilyDisciplineController::class, 'store'])->middleware('throttle:30,1')->name('discipline.store');
            Route::post('discipline/{punishment}/revoke', [Families\FamilyDisciplineController::class, 'revoke'])->whereNumber('punishment')->name('discipline.revoke');

            Route::get('events', [Families\FamilyEventController::class, 'index'])->name('events');
            Route::post('events', [Families\FamilyEventController::class, 'store'])->middleware('throttle:20,1')->name('events.store');
            Route::post('events/{event}/rsvp', [Families\FamilyEventController::class, 'rsvp'])->whereNumber('event')->name('events.rsvp');
            Route::post('events/{event}/close', [Families\FamilyEventController::class, 'close'])->whereNumber('event')->name('events.close');
            Route::get('rating', [Families\FamilyEventController::class, 'rating'])->name('rating');

            Route::get('audit', [Families\FamilyAuditController::class, 'index'])->name('audit');

            Route::get('settings', [Families\FamilySettingsController::class, 'index'])->name('settings');
            Route::post('settings/profile', [Families\FamilySettingsController::class, 'profile'])->name('settings.profile');
            Route::put('settings', [Families\FamilySettingsController::class, 'update'])->name('settings.update');
            Route::put('settings/webhooks', [Families\FamilySettingsController::class, 'webhooks'])->name('settings.webhooks');
            Route::post('settings/webhooks/test', [Families\FamilySettingsController::class, 'test'])->middleware('throttle:6,1')->name('settings.webhooks.test');
            Route::post('settings/digest', [Families\FamilySettingsController::class, 'digest'])->middleware('throttle:3,10')->name('settings.digest');
        });
    });

    Route::get('people', [PeopleController::class, 'index'])->middleware('module:people')->name('people.index');
    Route::get('search/quick', [PeopleController::class, 'quick'])->middleware('throttle:120,1')->name('search.quick');

    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read', [NotificationController::class, 'markAllRead'])->name('notifications.read');

    Route::get('me', [ProfileController::class, 'me'])->name('profile.me');
    Route::post('me/avatar', [ProfileController::class, 'updateAvatar'])->name('profile.avatar');
    Route::delete('me/avatar', [ProfileController::class, 'destroyAvatar'])->name('profile.avatar.destroy');
    Route::post('me/cover', [ProfileController::class, 'updateCover'])->name('profile.cover');

    Route::prefix('admin')->name('admin.')->middleware('admin')->group(function () {
        Route::get('/', Admin\DashboardController::class)->name('dashboard');
        Route::get('users', [Admin\UserController::class, 'index'])->name('users.index');
        Route::patch('users/{user}', [Admin\UserController::class, 'update'])->name('users.update');
        Route::delete('users/{user}', [Admin\UserController::class, 'destroy'])->name('users.destroy');
        Route::get('posts', [Admin\PostController::class, 'index'])->name('posts.index');
        Route::delete('posts/{post}', [Admin\PostController::class, 'destroy'])->name('posts.destroy');
        Route::post('posts/{post}/restore', [Admin\PostController::class, 'restore'])->name('posts.restore');
        Route::get('photos', [Admin\PhotoController::class, 'index'])->name('photos.index');
        Route::delete('photos/{photo}', [Admin\PhotoController::class, 'destroy'])->whereNumber('photo')->name('photos.destroy');
        Route::post('photos/{photo}/restore', [Admin\PhotoController::class, 'restore'])->whereNumber('photo')->name('photos.restore');
        Route::get('music', [Admin\MusicController::class, 'index'])->name('music.index');
        Route::delete('music/{track}', [Admin\MusicController::class, 'destroy'])->whereNumber('track')->name('music.destroy');
        Route::post('music/{track}/restore', [Admin\MusicController::class, 'restore'])->whereNumber('track')->name('music.restore');
        Route::prefix('cinema')->name('cinema.')->group(function () {
            Route::get('/', [Admin\CinemaController::class, 'index'])->name('index');
            Route::get('create', [Admin\CinemaController::class, 'create'])->name('create');
            Route::post('/', [Admin\CinemaController::class, 'store'])->name('store');
            Route::get('import', [Admin\CinemaController::class, 'import'])->name('import');
            Route::put('auto', [Admin\CinemaController::class, 'updateAuto'])->name('auto.update');
            Route::post('auto/run', [Admin\CinemaController::class, 'runAuto'])->middleware('throttle:10,1')->name('auto.run');
            Route::middleware('throttle:60,1')->group(function () {
                Route::get('remote/{provider}/search', [Admin\CinemaController::class, 'remoteSearch'])->whereIn('provider', ['kodik', 'flixcdn'])->name('remote.search');
                Route::get('remote/{provider}/latest', [Admin\CinemaController::class, 'remoteLatest'])->whereIn('provider', ['kodik', 'flixcdn'])->name('remote.latest');
                Route::post('remote/import', [Admin\CinemaController::class, 'remoteImport'])->name('remote.import');
            });
            Route::whereNumber(['movie', 'source'])->group(function () {
                Route::get('{movie}/edit', [Admin\CinemaController::class, 'edit'])->name('edit');
                Route::post('{movie}', [Admin\CinemaController::class, 'update'])->name('update');
                Route::patch('{movie}/flags', [Admin\CinemaController::class, 'flags'])->name('flags');
                Route::delete('{movie}', [Admin\CinemaController::class, 'destroy'])->name('destroy');
                Route::post('{movie}/restore', [Admin\CinemaController::class, 'restore'])->name('restore');
                Route::post('{movie}/refresh', [Admin\CinemaController::class, 'refresh'])->middleware('throttle:20,1')->name('refresh');
                Route::post('{movie}/enrich', [Admin\CinemaController::class, 'enrich'])->middleware('throttle:30,1')->name('enrich');
                Route::post('{movie}/sources', [Admin\CinemaController::class, 'storeSource'])->name('sources.store');
                Route::delete('{movie}/sources/{source}', [Admin\CinemaController::class, 'destroySource'])->name('sources.destroy');
            });
        });
        Route::get('integrations', [Admin\IntegrationController::class, 'index'])->name('integrations.index');
        Route::put('integrations/cinema/{provider}', [Admin\IntegrationController::class, 'updateCinema'])->name('integrations.cinema');
        Route::post('integrations/cinema/{provider}/test', [Admin\IntegrationController::class, 'testCinema'])->middleware('throttle:20,1')->name('integrations.cinema.test');
        Route::put('integrations/spotify', [Admin\IntegrationController::class, 'updateSpotify'])->name('integrations.spotify');
        Route::post('integrations/spotify/test', [Admin\IntegrationController::class, 'testSpotify'])->middleware('throttle:10,1')->name('integrations.spotify.test');
        Route::get('stickers', [Admin\StickerController::class, 'index'])->name('stickers.index');
        Route::post('stickers', [Admin\StickerController::class, 'store'])->name('stickers.store');
        Route::patch('stickers/{pack}', [Admin\StickerController::class, 'update'])->name('stickers.update');
        Route::delete('stickers/{pack}', [Admin\StickerController::class, 'destroy'])->name('stickers.destroy');
        Route::post('stickers/{pack}/items', [Admin\StickerController::class, 'upload'])->name('stickers.upload');
        Route::delete('stickers/{pack}/items/{sticker}', [Admin\StickerController::class, 'destroySticker'])->scopeBindings()->name('stickers.items.destroy');
        Route::get('communities', [Admin\CommunityController::class, 'index'])->name('communities.index');
        Route::patch('communities/{community:id}', [Admin\CommunityController::class, 'update'])->name('communities.update');
        Route::delete('communities/{community}', [Admin\CommunityController::class, 'destroy'])->whereNumber('community')->name('communities.destroy');
        Route::post('communities/{community}/restore', [Admin\CommunityController::class, 'restore'])->whereNumber('community')->name('communities.restore');
        Route::prefix('servers')->name('servers.')->group(function () {
            Route::get('/', [Admin\ServerController::class, 'index'])->name('index');
            Route::post('/', [Admin\ServerController::class, 'store'])->name('store');
            Route::post('sync', [Admin\ServerController::class, 'sync'])->middleware('throttle:10,1')->name('sync');
            Route::put('settings', [Admin\ServerController::class, 'settings'])->name('settings');
            Route::whereNumber('server')->group(function () {
                Route::post('{server:id}', [Admin\ServerController::class, 'update'])->name('update');
                Route::patch('{server:id}/moderate', [Admin\ServerController::class, 'moderate'])->name('moderate');
                Route::post('{server:id}/refresh', [Admin\ServerController::class, 'refresh'])->middleware('throttle:30,1')->name('refresh');
                Route::delete('{server:id}', [Admin\ServerController::class, 'destroy'])->name('destroy');
                Route::post('{server}/restore', [Admin\ServerController::class, 'restore'])->name('restore');
            });
        });
        Route::get('families', [Admin\FamilyController::class, 'index'])->name('families.index');
        Route::patch('families/{family:id}', [Admin\FamilyController::class, 'update'])->whereNumber('family')->name('families.update');
        Route::post('families/voice-rooms', [Admin\VoiceTemplateController::class, 'store'])->name('voice-templates.store');
        Route::patch('families/voice-rooms/{template}', [Admin\VoiceTemplateController::class, 'update'])->name('voice-templates.update');
        Route::delete('families/voice-rooms/{template}', [Admin\VoiceTemplateController::class, 'destroy'])->name('voice-templates.destroy');
        Route::get('modules', [Admin\ModuleController::class, 'index'])->name('modules.index');
        Route::patch('modules/{module}', [Admin\ModuleController::class, 'update'])->name('modules.update');
        Route::get('settings', [Admin\SettingsController::class, 'edit'])->name('settings.edit');
        Route::put('settings', [Admin\SettingsController::class, 'update'])->name('settings.update');
        Route::post('settings/mail-test', [Admin\SettingsController::class, 'mailTest'])->middleware('throttle:6,1')->name('settings.mail-test');
    });
});

require __DIR__.'/settings.php';

// Колбек Spotify поза сесією браузера: застосунок передає користувача в state.
Route::match(['get', 'post'], 'mail/unsubscribe/{user:id}', UnsubscribeController::class)
    ->whereNumber('user')->middleware(['signed', 'throttle:20,1'])->name('mail.unsubscribe');

Route::get('music/spotify/callback', [SpotifyController::class, 'callback'])
    ->middleware('module:music')
    ->name('spotify.callback');

// Плеєр для застосунку: сторінка на нашому домені, всередині iframe Kodik/YouTube.
Route::get('play/embed', [CinemaController::class, 'embed'])
    ->middleware('throttle:120,1')
    ->name('cinema.embed');

Route::get('id{id}', [ProfileController::class, 'byId'])->whereNumber('id')->name('profile.id');
Route::get('{user}', [ProfileController::class, 'show'])
    ->where('user', '[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9]')
    ->name('profile.show');
