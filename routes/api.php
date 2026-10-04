<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatApiController;
use App\Http\Controllers\Api\FeedApiController;
use App\Http\Controllers\Api\GroupsApiController;
use App\Http\Controllers\Api\MediaApiController;
use App\Http\Controllers\Api\PushApiController;
use App\Http\Controllers\Api\SocialApiController;
use App\Http\Controllers\CallController;
use App\Http\Controllers\CinemaController;
use App\Http\Controllers\ClanController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\CommunityMemberController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\Families;
use App\Http\Controllers\GameController;
use App\Http\Controllers\ListenPartyController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\MusicController;
use App\Http\Controllers\NowPlayingController;
use App\Http\Controllers\PhotoAlbumController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\PlayingController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ServerController;
use App\Http\Controllers\Settings\NavigationController;
use App\Http\Controllers\Settings\ProfileController as SettingsProfileController;
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\VoiceController;
use App\Http\Controllers\WatchPartyController;
use App\Http\Middleware\BridgeSiteAction;
use App\Models\VoiceRoom;
use Illuminate\Support\Facades\Route;

// Вебхук сервера голосу LiveKit (підпис перевіряє контролер).
Route::post('livekit/webhook', [VoiceController::class, 'webhook'])->middleware('throttle:600,1');

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

        // Історії на 24 години.
        Route::prefix('stories')->middleware('module:feed')->group(function () {
            Route::get('/', [StoryController::class, 'index']);
            Route::post('/', [StoryController::class, 'store'])->middleware('throttle:20,1');
            Route::get('u/{user}', [StoryController::class, 'ofUser']);
            Route::post('{story}/view', [StoryController::class, 'view'])->whereNumber('story')->middleware('throttle:240,1');
            Route::post('{story}/react', [StoryController::class, 'react'])->whereNumber('story')->middleware('throttle:30,1');
            Route::post('{story}/reply', [StoryController::class, 'reply'])->whereNumber('story')->middleware('throttle:30,1');
            Route::get('{story}/viewers', [StoryController::class, 'viewers'])->whereNumber('story');
            Route::delete('{story}', [StoryController::class, 'destroy'])->whereNumber('story');
        });

        // Голосові кімнати сімей і спільнот (звук — через LiveKit).
        Route::prefix('voice')->group(function () {
            Route::get('{type}/{id}', [VoiceController::class, 'index'])->whereIn('type', VoiceRoom::OWNERS)->whereNumber('id');
            Route::post('{type}/{id}', [VoiceController::class, 'store'])->whereIn('type', VoiceRoom::OWNERS)->whereNumber('id')->middleware('throttle:20,1');
            Route::patch('rooms/{room}', [VoiceController::class, 'update'])->whereNumber('room');
            Route::delete('rooms/{room}', [VoiceController::class, 'destroy'])->whereNumber('room');
            Route::post('rooms/{room}/join', [VoiceController::class, 'join'])->whereNumber('room')->middleware('throttle:30,1');
            Route::post('rooms/{room}/members/{user:id}', [VoiceController::class, 'moderate'])->whereNumber(['room', 'user'])->withoutScopedBindings();
        });

        Route::get('notifications', [SocialApiController::class, 'notifications']);
        Route::post('push/devices', [PushApiController::class, 'store'])->middleware('throttle:30,1');
        Route::delete('push/devices', [PushApiController::class, 'destroy']);
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
            Route::get('{conversation}/call', [CallController::class, 'show'])->whereNumber('conversation');
            Route::post('{conversation}/call', [CallController::class, 'start'])->whereNumber('conversation')->middleware('throttle:20,1');
        });

        // Каталог мультиплеєрних ігор.
        Route::prefix('games')->middleware('module:games')->group(function () {
            Route::get('/', [GameController::class, 'index']);
            Route::get('search', [GameController::class, 'search'])->middleware('throttle:120,1');
            Route::get('{game}', [GameController::class, 'show']);
        });

        // Спільний перегляд у застосунку: ті самі дії, стан — опитуванням.
        Route::middleware('module:cinema')->group(function () {
            Route::post('cinema/{movie}/watch', [WatchPartyController::class, 'store'])->middleware('throttle:10,1');
            Route::prefix('watch/{party}')->group(function () {
                Route::get('/', [WatchPartyController::class, 'show']);
                Route::get('state', [WatchPartyController::class, 'poll']);
                Route::post('state', [WatchPartyController::class, 'control'])->middleware('throttle:240,1');
                Route::post('shared', [WatchPartyController::class, 'shared']);
                Route::post('messages', [WatchPartyController::class, 'message'])->middleware('throttle:30,1');
                Route::post('voice', [WatchPartyController::class, 'voice'])->middleware('throttle:20,1');
                Route::post('invite', [WatchPartyController::class, 'invite'])->middleware('throttle:10,1');
                Route::delete('/', [WatchPartyController::class, 'end']);
            });
        });

        // Спільне прослуховування в застосунку: ті самі дії, стан — опитуванням.
        Route::middleware('module:music')->group(function () {
            Route::post('music/together', [ListenPartyController::class, 'store'])->middleware('throttle:10,1');
            Route::prefix('listen/{party}')->group(function () {
                Route::get('/', [ListenPartyController::class, 'show']);
                Route::get('state', [ListenPartyController::class, 'poll']);
                Route::post('state', [ListenPartyController::class, 'control'])->middleware('throttle:240,1');
                Route::post('queue', [ListenPartyController::class, 'enqueue'])->middleware('throttle:60,1');
                Route::delete('queue/{index}', [ListenPartyController::class, 'dequeue'])->whereNumber('index');
                Route::post('next', [ListenPartyController::class, 'next'])->middleware('throttle:60,1');
                Route::post('shared', [ListenPartyController::class, 'shared']);
                Route::post('invite', [ListenPartyController::class, 'invite'])->middleware('throttle:10,1');
                Route::post('share', [ListenPartyController::class, 'share'])->middleware('throttle:10,1');
                Route::delete('/', [ListenPartyController::class, 'end']);
            });
        });

        Route::prefix('calls/{call}')->whereNumber('call')->middleware('module:messages')->group(function () {
            Route::post('join', [CallController::class, 'join'])->middleware('throttle:30,1');
            Route::post('decline', [CallController::class, 'decline']);
            Route::post('leave', [CallController::class, 'leave']);
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
            Route::get('me/family-widget', [GroupsApiController::class, 'familyWidget']);
            // Застосунок на Android: гра на екрані → «Граю в…».
            Route::post('me/playing/mobile', [PlayingController::class, 'mobile'])->middleware('throttle:30,1');
            Route::get('me/playing/packages', [PlayingController::class, 'packages']);
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

        /*
         * Дії й сторінки сайту для застосунку: ті самі контролери, що й у routes/web.php, за тими самими
         * шляхами з префіксом /api/v1/site. BridgeSiteAction перетворює редиректи й Inertia-сторінки на JSON.
         */
        Route::prefix('site')->middleware(BridgeSiteAction::class)->group(function () {
            Route::middleware('module:feed')->group(function () {
                Route::post('posts/{post}/pin', [PostController::class, 'pin'])->whereNumber('post');
                Route::delete('comments/{comment}', [CommentController::class, 'destroy'])->whereNumber('comment');
                Route::post('comments/{comment}/like', [CommentController::class, 'like'])->whereNumber('comment')->middleware('throttle:120,1');
            });

            // Шапка профілю як на сайті: статистика, друзі, фото, аудіо, права (canPost, canMessage).
            Route::get('u/{user}', [ProfileController::class, 'show']);
            Route::post('me/avatar', [ProfileController::class, 'updateAvatar']);
            Route::delete('me/avatar', [ProfileController::class, 'destroyAvatar']);
            Route::post('me/cover', [ProfileController::class, 'updateCover']);
            Route::delete('settings/profile', [SettingsProfileController::class, 'destroy']);
            Route::put('settings/navigation', [NavigationController::class, 'update']);

            Route::prefix('messages')->middleware('module:messages')->whereNumber(['conversation', 'message'])->group(function () {
                Route::post('{conversation}/settings', [MessengerController::class, 'update']);
                Route::post('{conversation}/members', [MessengerController::class, 'addMembers']);
                Route::delete('{conversation}/members/{user}', [MessengerController::class, 'removeMember']);
                Route::patch('{conversation}/messages/{message}', [MessageController::class, 'update']);
                Route::delete('{conversation}/messages/{message}', [MessageController::class, 'destroy']);
            });

            Route::prefix('me/playing')->group(function () {
                Route::get('/', [PlayingController::class, 'show']);
                Route::get('search', [PlayingController::class, 'search'])->middleware('throttle:120,1');
                Route::put('/', [PlayingController::class, 'update'])->middleware('throttle:30,1');
                Route::delete('/', [PlayingController::class, 'destroy']);
                Route::put('auto', [PlayingController::class, 'auto']);
                Route::post('steam', [PlayingController::class, 'linkSteam'])->middleware('throttle:10,1');
                Route::delete('steam', [PlayingController::class, 'unlinkSteam']);
            });

            // Календар подій.
            Route::prefix('events')->middleware('module:events')->group(function () {
                Route::get('/', [EventController::class, 'index']);
                Route::post('server/{server}', [EventController::class, 'storeServer'])->middleware('throttle:20,1');
                Route::post('server/{event}/rsvp', [EventController::class, 'rsvpServer'])->whereNumber('event');
                Route::delete('server/{event}', [EventController::class, 'destroyServer'])->whereNumber('event');
            });

            // Клани й гільдії мультиплеєрних ігор.
            Route::prefix('clans')->middleware('module:clans')->group(function () {
                Route::get('/', [ClanController::class, 'index']);
                Route::get('create', [ClanController::class, 'create']);
                Route::post('/', [ClanController::class, 'store'])->middleware('throttle:10,1');
                Route::prefix('{clan}')->group(function () {
                    Route::get('/', [ClanController::class, 'show']);
                    Route::post('join', [ClanController::class, 'join'])->middleware('throttle:20,1');
                    Route::post('leave', [ClanController::class, 'leave']);
                    Route::post('members/{member}', [ClanController::class, 'member'])->whereNumber('member');
                    Route::post('settings', [ClanController::class, 'update']);
                    Route::post('news', [ClanController::class, 'news'])->middleware('throttle:20,1');
                    Route::delete('news/{news}', [ClanController::class, 'deleteNews'])->whereNumber('news');
                    Route::post('events', [ClanController::class, 'event'])->middleware('throttle:20,1');
                    Route::post('events/{event}/rsvp', [ClanController::class, 'rsvp'])->whereNumber('event');
                    Route::delete('events/{event}', [ClanController::class, 'deleteEvent'])->whereNumber('event');
                    Route::post('contributions', [ClanController::class, 'contribute'])->middleware('throttle:30,1');
                    Route::post('contributions/{contribution}', [ClanController::class, 'review'])->whereNumber('contribution');
                    Route::post('spend', [ClanController::class, 'spend'])->middleware('throttle:30,1');
                    Route::get('chat', [ClanController::class, 'chat']);
                });
            });

            Route::middleware('module:communities')->group(function () {
                Route::get('communities', [CommunityController::class, 'index']);
                Route::post('communities', [CommunityController::class, 'store'])->middleware('throttle:10,1');
            });

            Route::middleware('module:communities')->prefix('c/{community}')->group(function () {
                Route::get('/', [CommunityController::class, 'show']);
                Route::post('join', [CommunityController::class, 'join'])->middleware('throttle:60,1');
                Route::delete('join', [CommunityController::class, 'leave']);
                Route::get('photos', [PhotoController::class, 'community'])->middleware('module:photos');
                Route::delete('/', [CommunityController::class, 'destroy']);
                Route::get('settings', [CommunityController::class, 'edit']);
                Route::patch('settings', [CommunityController::class, 'update']);
                Route::post('images/{field}', [CommunityController::class, 'updateImage'])->whereIn('field', ['avatar', 'cover']);
                Route::get('members', [CommunityMemberController::class, 'index']);
                Route::post('members/{user}/approve', [CommunityMemberController::class, 'approve']);
                Route::delete('members/{user}/request', [CommunityMemberController::class, 'decline']);
                Route::patch('members/{user}', [CommunityMemberController::class, 'role']);
                Route::delete('members/{user}', [CommunityMemberController::class, 'destroy']);
            });

            Route::middleware('module:photos')->group(function () {
                Route::get('photos', [PhotoController::class, 'index']);
                Route::get('photos/u/{user}', [PhotoController::class, 'user']);
                Route::post('albums', [PhotoAlbumController::class, 'store'])->middleware('throttle:20,1');
            });

            Route::middleware('module:photos')->whereNumber(['album', 'photo'])->group(function () {
                Route::get('albums/{album}', [PhotoAlbumController::class, 'show']);
                Route::post('albums/{album}/photos', [PhotoAlbumController::class, 'upload'])->middleware('throttle:30,1');
                Route::get('photos/{photo}', [PhotoController::class, 'show']);
                Route::post('photos/{photo}/like', [PhotoController::class, 'like'])->middleware('throttle:120,1');
                Route::patch('albums/{album}', [PhotoAlbumController::class, 'update']);
                Route::delete('albums/{album}', [PhotoAlbumController::class, 'destroy']);
                Route::patch('photos/{photo}', [PhotoController::class, 'update']);
                Route::delete('photos/{photo}', [PhotoController::class, 'destroy']);
                Route::post('photos/{photo}/cover', [PhotoController::class, 'cover']);
                Route::get('photos/{photo}/comments', [PhotoController::class, 'comments']);
                Route::post('photos/{photo}/comments', [PhotoController::class, 'comment'])->middleware('throttle:30,1');
            });

            Route::prefix('music')->middleware('module:music')->group(function () {
                Route::get('/', [MusicController::class, 'index']);
                Route::get('u/{user}', [MusicController::class, 'user']);
                Route::post('tracks', [TrackController::class, 'store'])->middleware('throttle:60,1');
                Route::post('playlists', [PlaylistController::class, 'store'])->middleware('throttle:20,1');
                Route::get('search', [MusicController::class, 'search'])->middleware('throttle:120,1');
                Route::delete('now-playing', [NowPlayingController::class, 'destroy']);
                Route::whereNumber(['track', 'playlist'])->group(function () {
                    Route::post('tracks/{track}/library', [TrackController::class, 'add']);
                    Route::delete('tracks/{track}/library', [TrackController::class, 'remove']);
                    Route::get('playlists/{playlist}', [PlaylistController::class, 'show']);
                    Route::patch('tracks/{track}', [TrackController::class, 'update']);
                    Route::delete('tracks/{track}', [TrackController::class, 'destroy']);
                    Route::post('playlists/{playlist}', [PlaylistController::class, 'update']);
                    Route::delete('playlists/{playlist}', [PlaylistController::class, 'destroy']);
                    Route::post('playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'attach']);
                    Route::delete('playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'detach']);
                });
                Route::prefix('spotify')->middleware('throttle:120,1')->group(function () {
                    Route::patch('/', [SpotifyController::class, 'update']);
                    Route::get('search', [SpotifyController::class, 'search']);
                    Route::get('library/{section}', [SpotifyController::class, 'library']);
                    Route::get('playlists/{playlist}', [SpotifyController::class, 'playlist']);
                });
            });

            Route::prefix('cinema')->middleware('module:cinema')->group(function () {
                Route::get('/', [CinemaController::class, 'index']);
                Route::get('my', [CinemaController::class, 'my']);
                Route::get('search', [CinemaController::class, 'search'])->middleware('throttle:120,1');
                Route::get('{movie}', [CinemaController::class, 'show']);
                Route::patch('{movie}/status', [CinemaController::class, 'status'])->middleware('throttle:60,1');
                Route::put('{movie}/rating', [CinemaController::class, 'rate'])->middleware('throttle:60,1');
                Route::post('{movie}/started', [CinemaController::class, 'started'])->middleware('throttle:30,1');
                Route::get('{movie}/comments', [CinemaController::class, 'comments']);
                Route::post('{movie}/comments', [CinemaController::class, 'comment'])->middleware('throttle:30,1');
            });

            Route::prefix('servers')->middleware('module:servers')->group(function () {
                Route::get('/', [ServerController::class, 'index']);
                Route::post('suggest', [ServerController::class, 'suggest'])->middleware('throttle:5,10');
                Route::get('{server}', [ServerController::class, 'show']);
            });

            Route::middleware('module:families')->group(function () {
                Route::get('families', [Families\FamilyController::class, 'index']);
                Route::get('families/create', [Families\FamilyController::class, 'create']);
                Route::post('families', [Families\FamilyController::class, 'store'])->middleware('throttle:5,10');

                Route::prefix('f/{family}')->scopeBindings()->group(function () {
                    // Сторінки сім’ї — props ті самі, що бачить сайт (права FamilyGate, гроші в копійках).
                    Route::get('/', [Families\FamilyController::class, 'show']);
                    Route::post('apply', [Families\FamilyController::class, 'apply'])->middleware('throttle:10,10');
                    Route::get('chat', [Families\FamilyController::class, 'chat']);
                    Route::get('reports', [Families\FamilyReportController::class, 'index']);
                    Route::post('reports', [Families\FamilyReportController::class, 'store'])->middleware('throttle:30,1');
                    Route::get('queue', [Families\FamilyReportController::class, 'queue']);
                    Route::post('reports/{report}/review', [Families\FamilyReportController::class, 'review'])->whereNumber('report');
                    Route::get('proofs/{proof}', [Families\FamilyReportController::class, 'proof'])->whereNumber('proof');
                    Route::get('bank', [Families\FamilyBankController::class, 'index']);
                    Route::post('bank/cashouts', [Families\FamilyBankController::class, 'requestCashout'])->middleware('throttle:10,1');
                    Route::post('bank/deposits', [Families\FamilyBankController::class, 'openDeposit'])->middleware('throttle:10,1');
                    Route::post('bank/manual', [Families\FamilyBankController::class, 'manual'])->middleware('throttle:30,1');
                    Route::get('warehouse', [Families\FamilyWarehouseController::class, 'index']);
                    Route::get('warehouse/logs/{log}/proof', [Families\FamilyWarehouseController::class, 'proof'])->whereNumber('log');
                    Route::get('members', [Families\FamilyMemberController::class, 'index']);
                    Route::get('discipline', [Families\FamilyDisciplineController::class, 'index']);
                    Route::post('discipline', [Families\FamilyDisciplineController::class, 'store'])->middleware('throttle:30,1');
                    Route::get('events', [Families\FamilyEventController::class, 'index']);
                    Route::get('rating', [Families\FamilyEventController::class, 'rating']);
                    Route::get('audit', [Families\FamilyAuditController::class, 'index']);
                    Route::get('settings', [Families\FamilySettingsController::class, 'index']);
                    Route::put('settings', [Families\FamilySettingsController::class, 'update']);

                    Route::delete('apply', [Families\FamilyController::class, 'withdraw']);
                    Route::post('leave', [Families\FamilyController::class, 'leave']);
                    Route::post('reports/bulk', [Families\FamilyReportController::class, 'bulk']);

                    Route::whereNumber(['cashout', 'deposit', 'item', 'member', 'punishment', 'event'])->group(function () {
                        Route::post('bank/cashouts/{cashout}/pay', [Families\FamilyBankController::class, 'payCashout']);
                        Route::post('bank/cashouts/{cashout}/cancel', [Families\FamilyBankController::class, 'cancelCashout']);
                        Route::get('bank/cashouts/{cashout}/proof', [Families\FamilyBankController::class, 'cashoutProof']);
                        Route::post('bank/deposits/{deposit}/close', [Families\FamilyBankController::class, 'closeDeposit']);

                        Route::post('warehouse/move', [Families\FamilyWarehouseController::class, 'move'])->middleware('throttle:60,1');
                        Route::post('warehouse/items', [Families\FamilyWarehouseController::class, 'storeItem']);
                        Route::patch('warehouse/items/{item}', [Families\FamilyWarehouseController::class, 'updateItem']);

                        Route::put('ranks', [Families\FamilyMemberController::class, 'ranks']);
                        Route::post('members/{member}/accept', [Families\FamilyMemberController::class, 'accept']);
                        Route::post('members/{member}/decline', [Families\FamilyMemberController::class, 'decline']);
                        Route::patch('members/{member}', [Families\FamilyMemberController::class, 'update']);
                        Route::post('members/{member}/kick', [Families\FamilyMemberController::class, 'kick']);
                        Route::post('members/{member}/transfer', [Families\FamilyMemberController::class, 'transfer']);

                        Route::post('discipline/{punishment}/revoke', [Families\FamilyDisciplineController::class, 'revoke']);

                        Route::post('events', [Families\FamilyEventController::class, 'store'])->middleware('throttle:20,1');
                        Route::post('events/{event}/rsvp', [Families\FamilyEventController::class, 'rsvp']);
                        Route::post('events/{event}/close', [Families\FamilyEventController::class, 'close']);
                    });

                    Route::post('settings/profile', [Families\FamilySettingsController::class, 'profile']);
                    Route::put('settings/webhooks', [Families\FamilySettingsController::class, 'webhooks']);
                    Route::post('settings/webhooks/test', [Families\FamilySettingsController::class, 'test'])->middleware('throttle:6,1');
                    Route::post('settings/digest', [Families\FamilySettingsController::class, 'digest'])->middleware('throttle:3,10');
                });
            });
        });
    });
});
