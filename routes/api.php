<?php

use App\Http\Controllers\AiController;
use App\Http\Controllers\Api\AccountApiController;
use App\Http\Controllers\Api\AppLoginApiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatApiController;
use App\Http\Controllers\Api\FeedApiController;
use App\Http\Controllers\Api\GooglePlayController;
use App\Http\Controllers\Api\GroupsApiController;
use App\Http\Controllers\Api\MediaApiController;
use App\Http\Controllers\Api\PushApiController;
use App\Http\Controllers\Api\SocialApiController;
use App\Http\Controllers\Api\SubscriptionStatusController;
use App\Http\Controllers\Api\WidgetApiController;
use App\Http\Controllers\Bots;
use App\Http\Controllers\CallController;
use App\Http\Controllers\CharacterController;
use App\Http\Controllers\ChatBotController;
use App\Http\Controllers\ChatToolsController;
use App\Http\Controllers\CinemaController;
use App\Http\Controllers\ClanController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommunityChannelController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\CommunityMemberController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\Families;
use App\Http\Controllers\FollowController;
use App\Http\Controllers\GameBacklogController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\InviteLinkController;
use App\Http\Controllers\ListenPartyController;
use App\Http\Controllers\ListenRoomController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\MomentController;
use App\Http\Controllers\MusicConnectController;
use App\Http\Controllers\MusicController;
use App\Http\Controllers\MusicHubController;
use App\Http\Controllers\NowPlayingController;
use App\Http\Controllers\OAuth\TokenController as OAuthTokenController;
use App\Http\Controllers\PartyController;
use App\Http\Controllers\PhoneController;
use App\Http\Controllers\PhotoAlbumController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\PlayingController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QuestController;
use App\Http\Controllers\ReadyToPlayController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\SavedController;
use App\Http\Controllers\SeasonController;
use App\Http\Controllers\ServerController;
use App\Http\Controllers\Settings\AppearanceController;
use App\Http\Controllers\Settings\DigestController;
use App\Http\Controllers\Settings\ListeningController;
use App\Http\Controllers\Settings\NavigationController;
use App\Http\Controllers\Settings\ProfileController as SettingsProfileController;
use App\Http\Controllers\Settings\StreamController;
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\StatusController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\TeammateController;
use App\Http\Controllers\TournamentController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\TrackImportController;
use App\Http\Controllers\TranslateController;
use App\Http\Controllers\VoiceController;
use App\Http\Controllers\WatchPartyController;
use App\Http\Controllers\WrappedController;
use App\Http\Middleware\BridgeSiteAction;
use App\Models\VoiceRoom;
use Illuminate\Support\Facades\Route;

// Вебхук сервера голосу LiveKit (підпис перевіряє контролер).
Route::post('livekit/webhook', [VoiceController::class, 'webhook'])->middleware('throttle:600,1');

// Боти GameCon: оновлення Telegram (секрет у заголовку) і кнопки Discord (підпис Ed25519).
Route::post('bots/telegram', Bots\TelegramWebhookController::class)->middleware('throttle:600,1')->name('bots.telegram.webhook');
Route::post('bots/discord/interactions', Bots\DiscordInteractionsController::class)->middleware('throttle:600,1')->name('bots.discord.interactions');

// «Увійти через GameCon» для серверів: обмін коду, профіль гравця, синхронізація онлайну.
Route::prefix('oauth')->group(function () {
    Route::post('token', [OAuthTokenController::class, 'token'])->middleware('throttle:60,1');
    Route::get('userinfo', [OAuthTokenController::class, 'userinfo'])->middleware('throttle:300,1');
    Route::post('server/sync', [OAuthTokenController::class, 'sync'])->middleware('throttle:30,1');
});

Route::prefix('v1')->group(function () {
    // Мова застосунку: словник його рядків (мова — з X-Locale або Accept-Language).
    Route::get('i18n', [LocaleController::class, 'app'])->middleware('throttle:60,1');
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
        // «Увійти через застосунок GameCon»: застосунок підтверджує або відхиляє вхід браузера.
        Route::prefix('auth/app-login/{id}')->whereUuid('id')->middleware('throttle:app-login-app')->group(function () {
            Route::get('/', [AppLoginApiController::class, 'show']);
            Route::post('approve', [AppLoginApiController::class, 'approve']);
            Route::post('deny', [AppLoginApiController::class, 'deny']);
        });
        // GameCon+ у застосунку: лише статус доступу, без жодних цін і посилань на оплату.
        Route::get('user/subscription-status', SubscriptionStatusController::class)->middleware('throttle:60,1');
        // Покупка GameCon+ у застосунку — лише через Google Play Billing; сервер перевіряє токен у Google.
        Route::get('google-play', [GooglePlayController::class, 'show'])->middleware('throttle:60,1');
        Route::post('google-play/verify', [GooglePlayController::class, 'verify'])->middleware('throttle:30,1');
        Route::post('google-play/phone/hold', [GooglePlayController::class, 'phoneHold'])->middleware(['throttle:20,1', 'module:phone']);
        Route::post('google-play/phone/verify', [GooglePlayController::class, 'phoneVerify'])->middleware(['throttle:30,1', 'module:phone']);
        Route::post('me/locale', [LocaleController::class, 'update'])->middleware('throttle:30,1');
        Route::post('translate', TranslateController::class)->middleware('throttle:60,1');
        Route::post('logout', [AuthController::class, 'logout']);
        Route::patch('me', [SocialApiController::class, 'updateProfile']);
        Route::put('me/password', [SocialApiController::class, 'password']);
        Route::get('me/connections', [SocialApiController::class, 'connections']);
        Route::delete('me/connections/{provider}', [SocialApiController::class, 'unlink'])->whereIn('provider', ['discord', 'google']);

        // Акаунт: пристрої й сесії, журнал входів, заморожування, оскарження, скарги й відгуки.
        Route::get('me/security', [AccountApiController::class, 'show']);
        Route::delete('me/sessions/{session}', [AccountApiController::class, 'revokeSession'])->whereNumber('session');
        Route::delete('me/tokens/{token}', [AccountApiController::class, 'revokeToken'])->whereNumber('token');
        Route::delete('me/sessions', [AccountApiController::class, 'revokeOthers']);
        Route::put('me/profanity', [AccountApiController::class, 'profanity']);
        Route::post('me/freeze', [AccountApiController::class, 'freeze'])->middleware('throttle:6,1');
        Route::post('me/appeals', [AccountApiController::class, 'appeal'])->middleware('throttle:5,60');
        Route::post('users/{target}/report', [AccountApiController::class, 'report'])->middleware('throttle:10,10');
        Route::post('feedback', [AccountApiController::class, 'feedback'])->middleware('throttle:5,10');

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
                Route::post('suggest', [ListenRoomController::class, 'suggest'])->middleware('throttle:30,1');
                Route::post('suggestions/{index}', [ListenRoomController::class, 'review'])->whereNumber('index')->middleware('throttle:60,1');
                Route::post('react', [ListenRoomController::class, 'react'])->middleware('throttle:40,1');
                Route::post('chat', [ListenRoomController::class, 'chat'])->middleware('throttle:30,1');
                Route::post('kick', [ListenRoomController::class, 'kick'])->middleware('throttle:30,1');
                Route::post('host', [ListenRoomController::class, 'host'])->middleware('throttle:20,1');
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
            Route::post('{server}/vote', [GroupsApiController::class, 'voteServer'])->middleware('throttle:10,1');
        });

        Route::middleware('module:families')->group(function () {
            Route::get('me/family-widget', [GroupsApiController::class, 'familyWidget']);
            Route::get('me/pulse-widget', [WidgetApiController::class, 'pulse'])->middleware('throttle:30,1');
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
            // Бэклог ігор — ті самі дії, що й на сайті.
            Route::prefix('games')->middleware('module:games')->controller(GameBacklogController::class)->group(function () {
                Route::get('backlog', 'mine');
                Route::get('backlog/{user:username}', 'show');
                Route::put('{game}/backlog', 'update')->middleware('throttle:60,1');
            });
            // «Телефон»: свій номер, набирач, дзвінки й повідомлення за номером, подарунки й передача.
            // Купити номер у застосунку можна лише через Google Play Billing (google-play/phone/*).
            Route::prefix('phone')->middleware('module:phone')->controller(PhoneController::class)->group(function () {
                Route::get('/', 'index');
                Route::post('random', 'random')->middleware('throttle:10,1');
                Route::get('lookup', 'lookup')->middleware('throttle:60,1');
                Route::get('check', 'check')->middleware('throttle:120,1');
                Route::get('suggest', 'suggest')->middleware('throttle:60,1');
                Route::post('dial', 'dial')->middleware('throttle:30,1');
                Route::put('settings', 'settings');
                Route::post('dismiss', 'dismiss');
                Route::post('transfer', 'transfer')->middleware('throttle:20,1');
                Route::post('offers/{offer}/accept', 'accept')->whereNumber('offer');
                Route::post('offers/{offer}/decline', 'decline')->whereNumber('offer');
                Route::delete('offers/{offer}', 'cancel')->whereNumber('offer');
                Route::post('gifts/{number}/give', 'regift')->whereNumber('number')->middleware('throttle:20,1');
                Route::post('gifts/{number}/claim', 'claim')->whereNumber('number');
            });
            Route::middleware('module:feed')->group(function () {
                Route::post('posts/{post}/pin', [PostController::class, 'pin'])->whereNumber('post');
                Route::get('posts/drafts', [PostController::class, 'drafts']);
                Route::post('posts/{post}/publish', [PostController::class, 'release'])->whereNumber('post');
                Route::patch('posts/{post}', [PostController::class, 'update'])->whereNumber('post');
                Route::post('posts/{post}/share', [PostController::class, 'share'])->whereNumber('post')->middleware('throttle:30,1');
                Route::post('posts/{post}/quote', [PostController::class, 'quote'])->whereNumber('post')->middleware('throttle:30,1');
                Route::post('posts/{post}/hide', [PostController::class, 'hide'])->whereNumber('post');
                Route::post('posts/{post}/mute', [PostController::class, 'mute'])->whereNumber('post');
                Route::delete('comments/{comment}', [CommentController::class, 'destroy'])->whereNumber('comment');
                Route::post('comments/{comment}/like', [CommentController::class, 'like'])->whereNumber('comment')->middleware('throttle:120,1');
            });

            // Шапка профілю як на сайті: статистика, друзі, фото, аудіо, права (canPost, canMessage).
            Route::get('u/{user}', [ProfileController::class, 'show']);
            Route::get('u/{user}/card', [ProfileController::class, 'card']);
            Route::post('me/avatar', [ProfileController::class, 'updateAvatar']);
            Route::delete('me/avatar', [ProfileController::class, 'destroyAvatar']);
            Route::post('me/cover', [ProfileController::class, 'updateCover']);
            Route::delete('settings/profile', [SettingsProfileController::class, 'destroy']);
            Route::put('settings/navigation', [NavigationController::class, 'update']);
            Route::put('settings/theme', [AppearanceController::class, 'theme']);
            Route::put('settings/mode', [AppearanceController::class, 'mode']);
            // Свій канал Twitch/YouTube і позначка LIVE у профілі.
            Route::put('settings/stream', [StreamController::class, 'update'])->middleware('throttle:10,1');
            Route::delete('settings/stream', [StreamController::class, 'destroy']);
            Route::post('settings/stream/live', [StreamController::class, 'live'])->middleware('throttle:20,1');
            // «Показувати, що я слухаю» — те саме налаштування, що й на сайті.
            Route::patch('settings/digest', [DigestController::class, 'update'])->middleware('throttle:30,1');
            Route::patch('settings/listening', [ListeningController::class, 'update'])->middleware('throttle:30,1');

            // Збережене: пости, фільми, ігри й сервери.
            Route::get('saved', [SavedController::class, 'index']);
            Route::post('saved', [SavedController::class, 'toggle'])->middleware('throttle:60,1');
            // «Стежити» (сповіщення про новини гри, сервера чи фільму) і «Закріпити в профілі».
            Route::post('follows', [FollowController::class, 'toggle'])->middleware('throttle:60,1');
            Route::post('me/pin', [ProfileController::class, 'pin']);
            Route::get('ready', [ReadyToPlayController::class, 'show']);
            Route::put('ready', [ReadyToPlayController::class, 'update'])->middleware('throttle:30,1');
            Route::delete('ready', [ReadyToPlayController::class, 'destroy']);
            Route::put('me/status', [StatusController::class, 'update'])->middleware('throttle:30,1');
            Route::delete('me/status', [StatusController::class, 'destroy']);

            // Запросити друзів (реферальна програма) і вступ за посиланням-запрошенням у клан, сім’ю чи спільноту.
            Route::get('invite', [ReferralController::class, 'index']);
            Route::get('join/{token}', [InviteLinkController::class, 'show']);
            Route::post('join/{token}', [InviteLinkController::class, 'accept'])->middleware('throttle:20,1');

            Route::post('ai/rewrite', [AiController::class, 'rewrite'])->middleware('throttle:30,1');

            Route::prefix('messages')->middleware('module:messages')->whereNumber(['conversation', 'message'])->group(function () {
                Route::get('saved', [MessengerController::class, 'saved']);
                Route::get('{conversation}/catch-up', [MessengerController::class, 'catchUp'])->middleware('throttle:60,1');
                Route::post('{conversation}/settings', [MessengerController::class, 'update']);
                Route::post('{conversation}/members', [MessengerController::class, 'addMembers']);
                Route::delete('{conversation}/members/{user}', [MessengerController::class, 'removeMember']);
                Route::get('{conversation}/shared', [ChatToolsController::class, 'shared'])->middleware('throttle:120,1');
                Route::post('{conversation}/members/{user}/restrict', [ChatToolsController::class, 'restrict']);
                Route::delete('{conversation}/members/{user}/restrict', [ChatToolsController::class, 'lift']);
                Route::post('{conversation}/background', [ChatToolsController::class, 'background'])->middleware('throttle:30,1');
                Route::get('{conversation}/bots', [ChatBotController::class, 'index']);
                Route::put('{conversation}/bots/ai', [ChatBotController::class, 'ai'])->middleware('throttle:30,1');
                Route::post('{conversation}/ai/summary', [AiController::class, 'summary'])->middleware('throttle:20,1');
                Route::put('{conversation}/bots/welcome', [ChatBotController::class, 'welcome'])->middleware('throttle:30,1');
                Route::post('{conversation}/bots/posts', [ChatBotController::class, 'store'])->middleware('throttle:30,1');
                Route::patch('{conversation}/bots/posts/{automation}', [ChatBotController::class, 'update'])->whereNumber('automation');
                Route::delete('{conversation}/bots/posts/{automation}', [ChatBotController::class, 'destroy'])->whereNumber('automation');
                Route::get('attachments/{attachment}/preview', [ChatToolsController::class, 'preview'])->whereNumber('attachment')->middleware('throttle:120,1');
                Route::patch('{conversation}/messages/{message}', [MessageController::class, 'update']);
                Route::delete('{conversation}/messages/{message}', [MessageController::class, 'destroy']);
                Route::post('{conversation}/messages/{message}/report', [MessageController::class, 'report'])->middleware('throttle:20,1');
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
                Route::get('releases', [EventController::class, 'releases']);
                Route::put('reminder', [EventController::class, 'reminder']);
                Route::post('server/{server}', [EventController::class, 'storeServer'])->middleware('throttle:20,1');
                Route::post('server/{event}/rsvp', [EventController::class, 'rsvpServer'])->whereNumber('event');
                Route::delete('server/{event}', [EventController::class, 'destroyServer'])->whereNumber('event');
                Route::post('game/{game}', [EventController::class, 'storeGame'])->middleware('throttle:20,1');
                Route::post('game/{event}/rsvp', [EventController::class, 'rsvpGame'])->whereNumber('event');
                Route::delete('game/{event}', [EventController::class, 'destroyGame'])->whereNumber('event');
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
                Route::get('channels', [CommunityChannelController::class, 'index']);
                Route::post('channels', [CommunityChannelController::class, 'store'])->middleware('throttle:30,1');
                Route::put('channels/order', [CommunityChannelController::class, 'reorder']);
                Route::get('channels/members', [CommunityChannelController::class, 'members'])->middleware('throttle:60,1');
                Route::get('channels/{channel}', [CommunityChannelController::class, 'show'])->whereNumber('channel');
                Route::patch('channels/{channel}', [CommunityChannelController::class, 'update'])->whereNumber('channel');
                Route::delete('channels/{channel}', [CommunityChannelController::class, 'destroy'])->whereNumber('channel');
                Route::post('channel-categories', [CommunityChannelController::class, 'storeCategory'])->middleware('throttle:30,1');
                Route::patch('channel-categories/{category}', [CommunityChannelController::class, 'updateCategory'])->whereNumber('category');
                Route::delete('channel-categories/{category}', [CommunityChannelController::class, 'destroyCategory'])->whereNumber('category');
                Route::post('join', [CommunityController::class, 'join'])->middleware('throttle:60,1');
                Route::delete('join', [CommunityController::class, 'leave']);
                Route::get('photos', [PhotoController::class, 'community'])->middleware('module:photos');
                Route::delete('/', [CommunityController::class, 'destroy']);
                Route::get('settings', [CommunityController::class, 'edit']);
                Route::patch('settings', [CommunityController::class, 'update']);
                Route::put('settings/access', [CommunityController::class, 'updateAccess']);
                Route::post('ai/description', [AiController::class, 'description'])->middleware('throttle:10,1');
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
                // Розділ у стилі Apple Music (ті самі контролери, що й на сайті).
                Route::get('home', [MusicHubController::class, 'home']);
                Route::get('new', [MusicHubController::class, 'newest']);
                Route::get('radio', [MusicHubController::class, 'radio']);
                Route::get('library', [MusicHubController::class, 'library']);
                Route::post('library/sections', [MusicHubController::class, 'sections']);
                Route::get('library/{section}', [MusicHubController::class, 'librarySection'])->where('section', '[a-z]+');
                Route::get('artist', [MusicHubController::class, 'artist']);
                Route::get('artist/info', [MusicHubController::class, 'artistInfo'])->middleware('throttle:60,1');
                Route::get('album', [MusicHubController::class, 'album']);
                Route::get('mix/{key}', [MusicHubController::class, 'mix'])->where('key', '[a-z]+');
                Route::get('genre', [MusicHubController::class, 'genre']);
                Route::get('charts', [MusicHubController::class, 'charts']);
                Route::get('replay/{year?}', [MusicHubController::class, 'replay'])->whereNumber('year');
                Route::get('station', [MusicHubController::class, 'station'])->middleware('throttle:120,1');
                Route::get('playlists/mine', [MusicHubController::class, 'myPlaylists']);
                // Кімнати «Слухати разом» (ті самі шляхи, що на сайті).
                Route::get('rooms', [ListenRoomController::class, 'index']);
                Route::post('rooms', [ListenRoomController::class, 'store'])->middleware('throttle:10,1');
                Route::get('rooms/{type}/{id}', [ListenRoomController::class, 'group'])->whereIn('type', ['family', 'clan', 'community'])->whereNumber('id');
                Route::put('rooms/{type}/{id}/policy', [ListenRoomController::class, 'policy'])->whereIn('type', ['family', 'clan', 'community'])->whereNumber('id');
                Route::get('find', [MusicHubController::class, 'search']);
                Route::post('tracks/{track}/favorite', [MusicHubController::class, 'favorite'])->whereNumber('track');
                Route::delete('tracks/{track}/favorite', [MusicHubController::class, 'unfavorite'])->whereNumber('track');
                Route::get('u/{user}', [MusicController::class, 'user']);
                Route::post('tracks', [TrackController::class, 'store'])->middleware('throttle:60,1');
                Route::post('tracks/import', [TrackImportController::class, 'store'])->middleware('throttle:10,1');
                Route::get('imports', [TrackImportController::class, 'index']);
                Route::delete('imports/{import}', [TrackImportController::class, 'destroy'])->whereNumber('import');
                Route::post('playlists', [PlaylistController::class, 'store'])->middleware('throttle:20,1');
                Route::get('search', [MusicController::class, 'search'])->middleware('throttle:120,1');
                Route::delete('now-playing', [NowPlayingController::class, 'destroy']);
                Route::post('connect/heartbeat', [MusicConnectController::class, 'heartbeat'])->middleware('throttle:music-connect');
                Route::post('connect/command', [MusicConnectController::class, 'command'])->middleware('throttle:60,1');
                Route::get('lyrics/find', [TrackController::class, 'findLyrics'])->middleware('throttle:60,1');
                Route::whereNumber(['track', 'playlist'])->group(function () {
                    Route::post('tracks/{track}/library', [TrackController::class, 'add']);
                    Route::get('tracks/{track}/lyrics', [TrackController::class, 'lyrics']);
                    // «Завантажити на пристрій» в оригінальній якості (офлайн-музика застосунку).
                    Route::get('tracks/{track}/download', [TrackController::class, 'download']);
                    Route::get('tracks/{track}/metadata', [TrackController::class, 'metadata'])->middleware('throttle:10,1');
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
                Route::get('ten/{user:username}', [CinemaController::class, 'ten']);
                Route::post('ten', [CinemaController::class, 'toggleTen']);
                Route::post('ratings/{user:username}', [CinemaController::class, 'followRatings']);
                Route::get('search', [CinemaController::class, 'search'])->middleware('throttle:120,1');
                Route::get('{movie}', [CinemaController::class, 'show']);
                Route::patch('{movie}/status', [CinemaController::class, 'status'])->middleware('throttle:60,1');
                Route::put('{movie}/rating', [CinemaController::class, 'rate'])->middleware('throttle:60,1');
                Route::post('{movie}/started', [CinemaController::class, 'started'])->middleware('throttle:30,1');
                // Плеєр застосунку: серії й озвучки, позначки «переглянуто», місце перегляду, прямі потоки.
                Route::get('{movie}/episodes', [CinemaController::class, 'episodeList'])->middleware('throttle:60,1');
                Route::post('{movie}/episodes', [CinemaController::class, 'episode'])->middleware('throttle:60,1');
                Route::put('{movie}/progress', [CinemaController::class, 'progress'])->middleware('throttle:60,1');
                Route::get('{movie}/stream', [CinemaController::class, 'stream'])->middleware('throttle:60,1');
                Route::get('{movie}/comments', [CinemaController::class, 'comments']);
                Route::post('{movie}/comments', [CinemaController::class, 'comment'])->middleware('throttle:30,1');
            });

            Route::prefix('servers')->middleware('module:servers')->group(function () {
                Route::get('/', [ServerController::class, 'index']);
                Route::get('compare', [ServerController::class, 'compare']);
                Route::post('suggest', [ServerController::class, 'suggest'])->middleware('throttle:5,10');
                Route::get('{server}', [ServerController::class, 'show']);
            });

            Route::post('servers/{server}/tournaments', [TournamentController::class, 'store'])->middleware(['module:servers', 'throttle:10,10']);
            Route::prefix('tournaments')->middleware('module:servers')->whereNumber(['tournament', 'match', 'submission'])->group(function () {
                Route::get('/', [TournamentController::class, 'index']);
                Route::get('{tournament}', [TournamentController::class, 'show']);
                Route::post('{tournament}/join', [TournamentController::class, 'join'])->middleware('throttle:20,1');
                Route::delete('{tournament}/join', [TournamentController::class, 'leave']);
                Route::post('{tournament}/start', [TournamentController::class, 'start']);
                Route::post('{tournament}/matches/{match}', [TournamentController::class, 'report'])->middleware('throttle:60,1');
                Route::post('{tournament}/submissions', [TournamentController::class, 'submit'])->middleware('throttle:10,1');
                Route::post('{tournament}/submissions/{submission}', [TournamentController::class, 'review'])->middleware('throttle:120,1');
                Route::post('{tournament}/finish', [TournamentController::class, 'finish']);
                Route::delete('{tournament}', [TournamentController::class, 'destroy']);
            });

            Route::get('wrapped', [WrappedController::class, 'show'])->middleware('throttle:30,1');

            Route::prefix('quests')->middleware('module:quests')->group(function () {
                Route::get('/', [QuestController::class, 'index']);
                Route::post('{quest}/claim', [QuestController::class, 'claim'])->where('quest', '[a-z]{2,24}')->middleware('throttle:30,1');
            });

            Route::prefix('season')->middleware('module:quests')->group(function () {
                Route::get('/', [SeasonController::class, 'index']);
                Route::post('levels/{level}/{track}/claim', [SeasonController::class, 'claim'])->whereNumber('level')->whereIn('track', ['free', 'plus'])->middleware('throttle:60,1');
                Route::post('equip', [SeasonController::class, 'equip'])->middleware('throttle:60,1');
            });

            Route::prefix('moments')->middleware('module:moments')->whereNumber('moment')->group(function () {
                Route::get('/', [MomentController::class, 'index']);
                Route::post('/', [MomentController::class, 'store'])->middleware('throttle:10,60');
                Route::post('{moment}/like', [MomentController::class, 'like'])->middleware('throttle:120,1');
                Route::delete('{moment}', [MomentController::class, 'destroy']);
            });

            Route::prefix('party')->middleware('module:party')->whereNumber('party')->group(function () {
                Route::get('/', [PartyController::class, 'index']);
                Route::post('/', [PartyController::class, 'store'])->middleware('throttle:10,10');
                Route::get('match', [TeammateController::class, 'index']);
                Route::put('match/profile', [TeammateController::class, 'update'])->middleware('throttle:20,1');
                Route::post('match/looking', [TeammateController::class, 'looking'])->middleware('throttle:20,1');
                Route::post('{party}/invite', [TeammateController::class, 'invite'])->middleware('throttle:30,1');
                Route::get('{party}', [PartyController::class, 'show']);
                Route::post('{party}/join', [PartyController::class, 'join'])->middleware('throttle:20,1');
                Route::post('{party}/time', [PartyController::class, 'voteTime'])->middleware('throttle:30,1');
                Route::post('{party}/time/{slot}', [PartyController::class, 'pickTime'])->whereNumber('slot')->middleware('throttle:10,1');
                Route::delete('{party}/join', [PartyController::class, 'leave']);
                Route::delete('{party}', [PartyController::class, 'close']);
            });

            Route::prefix('characters')->middleware('module:servers')->whereNumber('character')->group(function () {
                Route::get('create', [CharacterController::class, 'create']);
                Route::post('/', [CharacterController::class, 'store'])->middleware('throttle:10,1');
                Route::get('{character}', [CharacterController::class, 'show']);
                Route::get('{character}/edit', [CharacterController::class, 'edit']);
                Route::post('{character}', [CharacterController::class, 'update'])->middleware('throttle:20,1');
                Route::delete('{character}', [CharacterController::class, 'destroy']);
                Route::post('{character}/photos', [CharacterController::class, 'addPhoto'])->middleware('throttle:20,1');
                Route::delete('{character}/photos/{index}', [CharacterController::class, 'removePhoto'])->whereNumber('index');
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
