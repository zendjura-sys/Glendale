<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\AppLinksController;
use App\Http\Controllers\ArticleController;
use App\Http\Controllers\Auth\AppLoginController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\Bots;
use App\Http\Controllers\CallController;
use App\Http\Controllers\CharacterController;
use App\Http\Controllers\ChatToolsController;
use App\Http\Controllers\CinemaController;
use App\Http\Controllers\ClanController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommunityChannelController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\CommunityGuestController;
use App\Http\Controllers\CommunityMemberController;
use App\Http\Controllers\CommunityWidgetController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\Families;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\FollowController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\GameBacklogController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\GameDealsController;
use App\Http\Controllers\GameRatingController;
use App\Http\Controllers\GameSoundtrackController;
use App\Http\Controllers\GameWallpaperController;
use App\Http\Controllers\GooglePlayRtdnController;
use App\Http\Controllers\HelpController;
use App\Http\Controllers\InviteLinkController;
use App\Http\Controllers\LegalController;
use App\Http\Controllers\ListenPartyController;
use App\Http\Controllers\ListenRoomController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\Mail\UnsubscribeController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\MomentController;
use App\Http\Controllers\MonobankWebhookController;
use App\Http\Controllers\MusicConnectController;
use App\Http\Controllers\MusicController;
use App\Http\Controllers\MusicHubController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NowPlayingController;
use App\Http\Controllers\OAuth;
use App\Http\Controllers\PartyController;
use App\Http\Controllers\PeopleController;
use App\Http\Controllers\PhoneController;
use App\Http\Controllers\PhotoAlbumController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\PlayingController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\PlusController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QuestController;
use App\Http\Controllers\ReadyToPlayController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\SavedController;
use App\Http\Controllers\SeasonController;
use App\Http\Controllers\ServerAppController;
use App\Http\Controllers\ServerController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\StartController;
use App\Http\Controllers\StatusController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\TeammateController;
use App\Http\Controllers\ThanksController;
use App\Http\Controllers\TournamentController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\TrackImportController;
use App\Http\Controllers\TranslateController;
use App\Http\Controllers\VoiceController;
use App\Http\Controllers\WatchPartyController;
use App\Http\Controllers\WebPushController;
use App\Http\Controllers\WelcomeController;
use App\Http\Controllers\WrappedController;
use App\Models\BotLink;
use App\Models\VoiceRoom;
use App\Services\Servers\ServerOAuth;
use Illuminate\Support\Facades\Route;

// Мова інтерфейсу: ручний вибір і словник сайту.
Route::post('locale', [LocaleController::class, 'update'])->middleware('throttle:30,1')->name('locale.update');
Route::get('i18n/{locale}.js', [LocaleController::class, 'script'])->where('locale', '[A-Za-z]{2,3}(-[A-Za-z0-9]{2,4}){0,2}')->name('locale.script');

Route::get('/', WelcomeController::class)->name('home');

// Вебхук еквайрингу monobank (без входу й CSRF; підпис X-Sign перевіряє контролер).
Route::post('billing/monobank/webhook', MonobankWebhookController::class)->middleware('throttle:120,1')->name('billing.monobank.webhook');
Route::post('billing/google-play/rtdn', GooglePlayRtdnController::class)->middleware('throttle:240,1')->name('billing.google-play.rtdn');

// Юридичні документи й тарифи — відкриті без входу (їх читають гості й платіжні сервіси). Мова: ?lang=en|uk|de|…
Route::get('terms', [LegalController::class, 'terms'])->name('legal.terms');
Route::get('privacy', [LegalController::class, 'privacy'])->name('legal.privacy');
Route::get('refund-policy', [LegalController::class, 'refund'])->name('legal.refund');
Route::get('pricing', [LegalController::class, 'pricing'])->name('legal.pricing');
Route::get('sitemap.xml', SitemapController::class)->middleware('throttle:30,1')->name('sitemap');
Route::get('contacts', [LegalController::class, 'contacts'])->name('legal.contacts');
Route::get('child-safety', [LegalController::class, 'childSafety'])->name('legal.child-safety');

// Довідка для новачків — відкрита без входу (тексти: App\Support\Help\HelpCatalog).
Route::prefix('help')->name('help.')->controller(HelpController::class)->where(['category' => '[a-z0-9-]+', 'article' => '[a-z0-9-]+'])->group(function () {
    Route::get('/', 'index')->name('index');
    Route::get('{category}', 'category')->name('category');
    Route::get('{category}/{article}', 'article')->name('article');
    Route::post('{category}/{article}/vote', 'vote')->middleware('throttle:20,1')->name('vote');
});

Route::redirect('dashboard', '/feed')->name('dashboard');

// Особисте посилання-запрошення: запам’ятовуємо запрошувача й ведемо на реєстрацію.
Route::get('r/{code}', [ReferralController::class, 'visit'])->where('code', '[a-z0-9]{8}')->middleware('throttle:60,1')->name('referrals.visit');

Route::prefix('auth')->name('auth.')->group(function () {
    Route::get('discord', [SocialAuthController::class, 'discordRedirect'])->middleware('throttle:20,1')->name('discord');
    Route::get('discord/callback', [SocialAuthController::class, 'discordCallback'])->middleware('throttle:20,1')->name('discord.callback');
    Route::post('firebase', [SocialAuthController::class, 'firebase'])->middleware('throttle:20,1')->name('firebase');
    Route::delete('social/{provider}', [SocialAuthController::class, 'unlink'])->middleware('auth')->whereIn('provider', ['discord', 'google'])->name('social.unlink');
});

// «Увійти через застосунок GameCon»: браузер гостя створює запит і опитує його стан;
// app-login/{id} — те, що кодує QR (відкриває застосунок або підказує, як це зробити).
Route::middleware('guest')->prefix('login/app')->name('login.app.')->group(function () {
    Route::post('requests', [AppLoginController::class, 'store'])->middleware('throttle:app-login')->name('store');
    Route::get('requests/{id}', [AppLoginController::class, 'show'])->whereUuid('id')->middleware('throttle:app-login-poll')->name('show');
});
Route::get('app-login/{id}', [AppLoginController::class, 'open'])->whereUuid('id')->middleware('throttle:60,1')->name('app-login.open');
Route::get('.well-known/assetlinks.json', AppLinksController::class)->middleware('throttle:60,1')->name('app-links');

Route::middleware(['auth', 'verified.site'])->group(function () {
    Route::get('join/{token}', [InviteLinkController::class, 'show'])->name('invites.show');
    Route::post('join/{token}', [InviteLinkController::class, 'accept'])->middleware('throttle:20,1')->name('invites.accept');

    Route::get('feed', [FeedController::class, 'index'])->middleware('module:feed')->name('feed');
    Route::get('invite', [ReferralController::class, 'index'])->name('referrals.index');
    // Оплата (лише сайт, усередині GameCon+): покупка карткою через monobank, картки, автопродовження, історія.
    Route::prefix('plus/billing')->name('billing.')->controller(BillingController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('purchase', 'purchase')->middleware('throttle:20,1')->name('purchase');
        Route::post('promo', 'promo')->middleware('throttle:10,1')->name('promo');
        Route::get('quote', 'quote')->middleware('throttle:60,1')->name('quote');
        Route::get('orders/{order}', 'showOrder')->whereNumber('order')->middleware('throttle:60,1')->name('orders.show');
        Route::get('orders/{order}/return', 'returned')->whereNumber('order')->name('orders.return');
        Route::delete('orders/{order}', 'cancelOrder')->whereNumber('order')->middleware('throttle:20,1')->name('orders.cancel');
        Route::post('orders/{order}/google-pay', 'googlePay')->whereNumber('order')->middleware('throttle:10,1')->name('orders.google-pay');
        Route::delete('cards/{card}', 'forgetCard')->whereNumber('card')->middleware('throttle:20,1')->name('cards.destroy');
        Route::post('renewals', 'renewal')->middleware('throttle:20,1')->name('renewals');
    });
    Route::prefix('plus')->name('plus.')->group(function () {
        Route::get('/', [PlusController::class, 'index'])->name('index');
        Route::post('redeem', [PlusController::class, 'redeem'])->middleware('throttle:10,1')->name('redeem');
        Route::put('style', [PlusController::class, 'style'])->name('style');
        Route::put('families/{family:id}/style', [PlusController::class, 'familyStyle'])->whereNumber('family')->name('families.style');
    });
    Route::get('start', [StartController::class, 'index'])->name('start');
    Route::post('start', [StartController::class, 'store'])->name('start.store');
    Route::post('start/skip', [StartController::class, 'skip'])->name('start.skip');
    Route::get('start/mode', [StartController::class, 'mode'])->name('start.mode');
    Route::get('start/phone', [StartController::class, 'phone'])->name('start.phone');
    Route::post('start/phone', [StartController::class, 'phoneDone'])->name('start.phone.done');
    // Внутрішні номери: свій номер, набирач, дзвінки й повідомлення за номером.
    Route::prefix('phone')->name('phone.')->middleware('module:phone')->controller(PhoneController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('picker', 'picker')->name('picker');
        Route::post('random', 'random')->middleware('throttle:10,1')->name('random');
        Route::get('check', 'check')->middleware('throttle:120,1')->name('check');
        Route::get('suggest', 'suggest')->middleware('throttle:60,1')->name('suggest');
        Route::get('lookup', 'lookup')->middleware('throttle:60,1')->name('lookup');
        Route::post('dial', 'dial')->middleware('throttle:30,1')->name('dial');
        Route::put('settings', 'settings')->name('settings');
        Route::post('dismiss', 'dismiss')->name('dismiss');
        // Подарунки й передача номера друзям.
        Route::post('transfer', 'transfer')->middleware('throttle:20,1')->name('transfer');
        Route::post('offers/{offer}/accept', 'accept')->whereNumber('offer')->name('offers.accept');
        Route::post('offers/{offer}/decline', 'decline')->whereNumber('offer')->name('offers.decline');
        Route::delete('offers/{offer}', 'cancel')->whereNumber('offer')->name('offers.cancel');
        Route::post('gifts/{number}/give', 'regift')->whereNumber('number')->middleware('throttle:20,1')->name('gifts.give');
        Route::post('gifts/{number}/claim', 'claim')->whereNumber('number')->name('gifts.claim');
    });
    Route::post('start/mode', [StartController::class, 'chooseMode'])->name('start.mode.store');
    Route::get('cards/search', [FollowController::class, 'cards'])->middleware('throttle:120,1')->name('cards.search');
    Route::post('follows', [FollowController::class, 'toggle'])->middleware('throttle:60,1')->name('follows.toggle');

    Route::post('posts', [PostController::class, 'store'])->middleware('throttle:30,1')->name('posts.store');
    Route::get('posts/drafts', [PostController::class, 'drafts'])->name('posts.drafts');
    Route::get('posts/{post}', [PostController::class, 'show'])->name('posts.show');
    Route::patch('posts/{post}', [PostController::class, 'update'])->name('posts.update');
    Route::post('posts/{post}/publish', [PostController::class, 'release'])->name('posts.publish');
    Route::delete('posts/{post}', [PostController::class, 'destroy'])->name('posts.destroy');
    Route::post('posts/{post}/pin', [PostController::class, 'pin'])->name('posts.pin');
    Route::post('posts/{post}/hide', [PostController::class, 'hide'])->name('posts.hide');
    Route::post('posts/{post}/mute', [PostController::class, 'mute'])->name('posts.mute');
    Route::post('posts/{post}/share', [PostController::class, 'share'])->middleware('throttle:30,1')->name('posts.share');
    Route::post('posts/{post}/quote', [PostController::class, 'quote'])->middleware('throttle:30,1')->name('posts.quote');
    Route::post('posts/{post}/like', [PostController::class, 'like'])->middleware('throttle:120,1')->name('posts.like');
    Route::post('posts/{post}/poll', [PostController::class, 'vote'])->middleware('throttle:60,1')->name('posts.poll');
    Route::get('saved', [SavedController::class, 'index'])->name('saved.index');
    Route::post('saved', [SavedController::class, 'toggle'])->middleware('throttle:60,1')->name('saved.toggle');

    Route::get('posts/{post}/comments', [CommentController::class, 'index'])->name('comments.index');
    Route::post('posts/{post}/comments', [CommentController::class, 'store'])->middleware('throttle:30,1')->name('comments.store');
    Route::delete('comments/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');
    Route::post('comments/{comment}/like', [CommentController::class, 'like'])->middleware('throttle:120,1')->name('comments.like');
    Route::post('comments/{comment}/pin', [CommentController::class, 'pin'])->name('comments.pin');

    Route::post('block/{user}', [ProfileController::class, 'block'])->name('blocks.toggle');
    Route::post('report/{user}', [ProfileController::class, 'report'])->middleware('throttle:10,10')->name('users.report');
    Route::post('feedback', [FeedbackController::class, 'store'])->middleware('throttle:5,10')->name('feedback.store');
    Route::post('thanks', [ThanksController::class, 'store'])->middleware('throttle:60,1')->name('thanks.store');
    Route::get('oauth/authorize', [OAuth\AuthorizeController::class, 'show'])->name('oauth.authorize');
    Route::post('oauth/authorize', [OAuth\AuthorizeController::class, 'decide'])->middleware('throttle:30,1')->name('oauth.decide');
    Route::get('developers', fn () => Inertia\Inertia::render('developers/oauth', ['scopes' => ServerOAuth::SCOPES, 'base' => url('/')]))->name('developers');
    Route::prefix('bots')->name('bots.')->group(function () {
        Route::get('{type}/{id}', [Bots\BotLinkController::class, 'state'])->whereIn('type', BotLink::OWNERS)->whereNumber('id')->middleware('throttle:30,1')->name('state');
        Route::post('{type}/{id}/telegram', [Bots\BotLinkController::class, 'telegram'])->whereIn('type', BotLink::OWNERS)->whereNumber('id')->middleware('throttle:20,1')->name('telegram');
        Route::post('{type}/{id}/discord', [Bots\BotLinkController::class, 'discord'])->whereIn('type', BotLink::OWNERS)->whereNumber('id')->middleware('throttle:20,1')->name('discord');
        Route::get('discord/callback', [Bots\BotLinkController::class, 'discordCallback'])->name('discord.callback');
        Route::patch('links/{link}', [Bots\BotLinkController::class, 'update'])->whereNumber('link')->name('update');
        Route::post('links/{link}/panel', [Bots\BotLinkController::class, 'panel'])->whereNumber('link')->middleware('throttle:10,1')->name('panel');
        Route::post('links/{link}/roles', [Bots\BotLinkController::class, 'roles'])->whereNumber('link')->middleware('throttle:6,1')->name('roles');
        Route::delete('links/{link}', [Bots\BotLinkController::class, 'destroy'])->whereNumber('link')->name('destroy');
        Route::post('telegram/account', [Bots\BotLinkController::class, 'telegramAccount'])->middleware('throttle:10,1')->name('telegram.account');
        Route::delete('telegram/account', [Bots\BotLinkController::class, 'telegramUnlink'])->name('telegram.unlink');
    });
    Route::get('push/web/key', [WebPushController::class, 'key'])->name('web-push.key');
    Route::post('push/web', [WebPushController::class, 'store'])->middleware('throttle:20,1')->name('web-push.store');
    Route::delete('push/web', [WebPushController::class, 'destroy'])->name('web-push.destroy');

    Route::middleware('module:friends')->group(function () {
        Route::get('friends', [FriendController::class, 'index'])->name('friends.index');
        Route::post('friends/{user}', [FriendController::class, 'store'])->middleware('throttle:60,1')->name('friends.store');
        Route::post('friends/{user}/accept', [FriendController::class, 'accept'])->name('friends.accept');
        Route::put('friends/{user}/mark', [FriendController::class, 'mark'])->name('friends.mark');
        Route::delete('friends/{user}', [FriendController::class, 'destroy'])->name('friends.destroy');
    });

    // Історії на 24 години.
    Route::prefix('stories')->name('stories.')->middleware('module:feed')->group(function () {
        Route::get('/', [StoryController::class, 'index'])->name('index');
        Route::post('/', [StoryController::class, 'store'])->middleware('throttle:20,1')->name('store');
        Route::get('u/{user}', [StoryController::class, 'ofUser'])->name('user');
        Route::post('{story}/view', [StoryController::class, 'view'])->whereNumber('story')->middleware('throttle:240,1')->name('view');
        Route::post('{story}/react', [StoryController::class, 'react'])->whereNumber('story')->middleware('throttle:30,1')->name('react');
        Route::post('{story}/reply', [StoryController::class, 'reply'])->whereNumber('story')->middleware('throttle:30,1')->name('reply');
        Route::post('{story}/vote', [StoryController::class, 'vote'])->whereNumber('story')->middleware('throttle:30,1')->name('vote');
        Route::get('{story}/poll', [StoryController::class, 'poll'])->whereNumber('story')->middleware('throttle:120,1')->name('poll');
        Route::get('{story}/viewers', [StoryController::class, 'viewers'])->whereNumber('story')->name('viewers');
        Route::delete('{story}', [StoryController::class, 'destroy'])->whereNumber('story')->name('destroy');
    });

    // Голосові кімнати сімей і спільнот (звук — через LiveKit).
    Route::prefix('voice')->name('voice.')->group(function () {
        Route::get('{type}/{id}', [VoiceController::class, 'index'])->whereIn('type', VoiceRoom::OWNERS)->whereNumber('id')->name('index');
        Route::post('{type}/{id}', [VoiceController::class, 'store'])->whereIn('type', VoiceRoom::OWNERS)->whereNumber('id')->middleware('throttle:20,1')->name('store');
        Route::patch('rooms/{room}', [VoiceController::class, 'update'])->whereNumber('room')->name('update');
        Route::delete('rooms/{room}', [VoiceController::class, 'destroy'])->whereNumber('room')->name('destroy');
        Route::post('rooms/{room}/join', [VoiceController::class, 'join'])->whereNumber('room')->middleware('throttle:30,1')->name('join');
        Route::post('rooms/{room}/invite-link', [InviteLinkController::class, 'voice'])->whereNumber('room')->middleware('throttle:20,1')->name('invite-link');
        Route::post('rooms/{room}/members/{user:id}', [VoiceController::class, 'moderate'])->whereNumber(['room', 'user'])->withoutScopedBindings()->name('moderate');
    });

    Route::prefix('calls/{call}')->name('calls.')->whereNumber('call')->middleware('module:messages')->group(function () {
        Route::post('join', [CallController::class, 'join'])->middleware('throttle:30,1')->name('join');
        Route::post('decline', [CallController::class, 'decline'])->name('decline');
        Route::post('leave', [CallController::class, 'leave'])->name('leave');
    });

    Route::prefix('messages')->name('messages.')->middleware('module:messages')->group(function () {
        Route::get('/', [MessengerController::class, 'index'])->name('index');
        Route::get('contacts', [MessengerController::class, 'contacts'])->name('contacts');
        Route::get('stickers', [MessageController::class, 'stickers'])->name('stickers');
        Route::get('saved', [MessengerController::class, 'saved'])->name('saved');
        Route::get('cards', [MessageController::class, 'cards'])->middleware('throttle:60,1')->name('cards');
        Route::get('attachments/{attachment}', [MessageController::class, 'download'])->whereNumber('attachment')->name('attachments.download');
        Route::get('attachments/{attachment}/preview', [ChatToolsController::class, 'preview'])->whereNumber('attachment')->middleware('throttle:120,1')->name('attachments.preview');
        Route::get('with/{user}', [MessengerController::class, 'direct'])->name('direct');
        Route::post('groups', [MessengerController::class, 'storeGroup'])->middleware('throttle:10,1')->name('groups.store');

        Route::whereNumber(['conversation', 'message'])->group(function () {
            Route::get('{conversation}', [MessengerController::class, 'show'])->name('show');
            Route::get('{conversation}/history', [MessengerController::class, 'history'])->name('history');
            Route::get('{conversation}/catch-up', [MessengerController::class, 'catchUp'])->middleware('throttle:60,1')->name('catch-up');
            Route::post('{conversation}', [MessageController::class, 'store'])->middleware('throttle:60,1')->name('store');
            Route::post('{conversation}/settings', [MessengerController::class, 'update'])->name('update');
            Route::post('{conversation}/read', [MessengerController::class, 'read'])->name('read');
            Route::post('{conversation}/mute', [MessengerController::class, 'mute'])->name('mute');
            Route::post('{conversation}/pin', [MessengerController::class, 'pin'])->name('pin');
            Route::post('{conversation}/unread', [MessengerController::class, 'markUnread'])->name('unread');
            Route::post('{conversation}/slow', [MessengerController::class, 'slow'])->name('slow');
            Route::post('{conversation}/automod', [MessengerController::class, 'automod'])->name('automod');
            Route::post('{conversation}/members/{user}/role', [MessengerController::class, 'memberRole'])->name('members.role');
            Route::get('{conversation}/shared', [ChatToolsController::class, 'shared'])->middleware('throttle:120,1')->name('shared');
            Route::post('{conversation}/members/{user}/restrict', [ChatToolsController::class, 'restrict'])->name('members.restrict');
            Route::delete('{conversation}/members/{user}/restrict', [ChatToolsController::class, 'lift'])->name('members.lift');
            Route::post('{conversation}/background', [ChatToolsController::class, 'background'])->middleware('throttle:30,1')->name('background');
            Route::post('{conversation}/receipts', [MessengerController::class, 'receipts'])->name('receipts');
            Route::put('{conversation}/folder', [MessengerController::class, 'folder'])->name('folder');
            Route::post('{conversation}/members', [MessengerController::class, 'addMembers'])->name('members.store');
            Route::delete('{conversation}/members/{user}', [MessengerController::class, 'removeMember'])->name('members.destroy');
            Route::patch('{conversation}/messages/{message}', [MessageController::class, 'update'])->name('messages.update');
            Route::delete('{conversation}/messages/{message}', [MessageController::class, 'destroy'])->name('messages.destroy');
            Route::post('{conversation}/messages/{message}/report', [MessageController::class, 'report'])->middleware('throttle:20,1')->name('messages.report');
            Route::post('{conversation}/messages/{message}/forward', [MessageController::class, 'forward'])->middleware('throttle:30,1')->name('messages.forward');
            Route::post('{conversation}/messages/{message}/favorite', [MessageController::class, 'favorite'])->name('messages.favorite');
            Route::post('{conversation}/messages/{message}/react', [MessageController::class, 'react'])->middleware('throttle:60,1')->name('messages.react');
            // Дзвінки в бесіді (звук — через LiveKit).
            Route::get('{conversation}/call', [CallController::class, 'show'])->name('call.show');
            Route::post('{conversation}/call', [CallController::class, 'start'])->middleware('throttle:20,1')->name('call.start');
        });
    });

    Route::middleware('module:communities')->group(function () {
        Route::post('communities', [CommunityController::class, 'store'])->middleware('throttle:10,1')->name('communities.store');

        Route::prefix('c/{community}')->name('communities.')->group(function () {
            Route::get('/', [CommunityController::class, 'show'])->name('show');
            Route::delete('/', [CommunityController::class, 'destroy'])->name('destroy');
            // Канали спільноти (текстові, «Оголошення», голосові) — як у Discord.
            Route::get('channels', [CommunityChannelController::class, 'index'])->name('channels.index');
            Route::post('channels', [CommunityChannelController::class, 'store'])->middleware('throttle:30,1')->name('channels.store');
            Route::put('channels/order', [CommunityChannelController::class, 'reorder'])->name('channels.order');
            Route::get('channels/members', [CommunityChannelController::class, 'members'])->middleware('throttle:60,1')->name('channels.members');
            Route::get('channels/{channel}', [CommunityChannelController::class, 'show'])->whereNumber('channel')->name('channels.show');
            Route::patch('channels/{channel}', [CommunityChannelController::class, 'update'])->whereNumber('channel')->name('channels.update');
            Route::delete('channels/{channel}', [CommunityChannelController::class, 'destroy'])->whereNumber('channel')->name('channels.destroy');
            Route::post('channel-categories', [CommunityChannelController::class, 'storeCategory'])->middleware('throttle:30,1')->name('channels.categories.store');
            Route::patch('channel-categories/{category}', [CommunityChannelController::class, 'updateCategory'])->whereNumber('category')->name('channels.categories.update');
            Route::delete('channel-categories/{category}', [CommunityChannelController::class, 'destroyCategory'])->whereNumber('category')->name('channels.categories.destroy');
            Route::get('settings', [CommunityController::class, 'edit'])->name('edit');
            Route::patch('settings', [CommunityController::class, 'update'])->name('update');
            Route::patch('settings/rules', [CommunityController::class, 'updateRules'])->name('rules.update');
            Route::put('settings/jar', [CommunityController::class, 'updateJar'])->name('jar.update');
            Route::put('settings/access', [CommunityController::class, 'updateAccess'])->name('access.update');
            Route::get('rules', [CommunityController::class, 'page'])->defaults('page', 'rules')->name('rules');
            Route::get('handbook', [CommunityController::class, 'page'])->defaults('page', 'handbook')->name('handbook');
            Route::post('queue/{post}', [CommunityController::class, 'approvePost'])->whereNumber('post')->name('queue.approve');
            Route::delete('queue/{post}', [CommunityController::class, 'rejectPost'])->whereNumber('post')->name('queue.reject');
            Route::patch('members/{user}/title', [CommunityMemberController::class, 'title'])->name('members.title');
            Route::post('images/{field}', [CommunityController::class, 'updateImage'])->whereIn('field', ['avatar', 'cover'])->name('image');
            Route::post('join', [CommunityController::class, 'join'])->middleware('throttle:60,1')->name('join');
            Route::post('invite-link', [InviteLinkController::class, 'community'])->middleware('throttle:20,1')->name('invite-link');
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
            Route::post('albums/{album}/contributors', [PhotoAlbumController::class, 'storeContributor'])->middleware('throttle:30,1')->name('albums.contributors.store');
            Route::delete('albums/{album}/contributors/{user}', [PhotoAlbumController::class, 'destroyContributor'])->name('albums.contributors.destroy');

            Route::get('photos/{photo}', [PhotoController::class, 'show'])->name('photos.show');
            Route::post('photos/{photo}/tags', [PhotoController::class, 'tag'])->middleware('throttle:30,1')->name('photos.tags.store');
            Route::delete('photos/{photo}/tags/{user}', [PhotoController::class, 'untag'])->name('photos.tags.destroy');
            Route::patch('photos/{photo}', [PhotoController::class, 'update'])->name('photos.update');
            Route::delete('photos/{photo}', [PhotoController::class, 'destroy'])->name('photos.destroy');
            Route::post('photos/{photo}/cover', [PhotoController::class, 'cover'])->name('photos.cover');
            Route::post('photos/{photo}/like', [PhotoController::class, 'like'])->middleware('throttle:120,1')->name('photos.like');
            Route::get('photos/{photo}/comments', [PhotoController::class, 'comments'])->name('photos.comments.index');
            Route::post('photos/{photo}/comments', [PhotoController::class, 'comment'])->middleware('throttle:30,1')->name('photos.comments.store');
        });
    });

    Route::prefix('music')->middleware('module:music')->group(function () {
        // Розділ у стилі Apple Music: Головна, Нове, Радіо, Медіатека, Пошук.
        Route::get('/', [MusicHubController::class, 'home'])->name('music.index');
        Route::get('new', [MusicHubController::class, 'newest'])->name('music.new');
        Route::get('radio', [MusicHubController::class, 'radio'])->name('music.radio');
        Route::get('library', [MusicHubController::class, 'library'])->name('music.library');
        Route::post('library/sections', [MusicHubController::class, 'sections'])->name('music.library.sections');
        Route::get('library/{section}', [MusicHubController::class, 'librarySection'])->where('section', '[a-z]+')->name('music.library.section');
        Route::get('artist', [MusicHubController::class, 'artist'])->name('music.artist');
        Route::get('artist/info', [MusicHubController::class, 'artistInfo'])->middleware('throttle:60,1')->name('music.artist.info');
        Route::get('album', [MusicHubController::class, 'album'])->name('music.album');
        Route::get('mix/{key}', [MusicHubController::class, 'mix'])->where('key', '[a-z]+')->name('music.mix');
        Route::get('genre', [MusicHubController::class, 'genre'])->name('music.genre');
        Route::get('charts', [MusicHubController::class, 'charts'])->name('music.charts');
        Route::get('replay/{year?}', [MusicHubController::class, 'replay'])->whereNumber('year')->name('music.replay');
        Route::get('station', [MusicHubController::class, 'station'])->middleware('throttle:120,1')->name('music.station');
        Route::get('playlists/mine', [MusicHubController::class, 'myPlaylists'])->name('music.playlists.mine');
        Route::get('menu-covers', [MusicHubController::class, 'menuCovers'])->middleware('throttle:60,1')->name('music.menu-covers');
        Route::post('tracks/{track}/favorite', [MusicHubController::class, 'favorite'])->whereNumber('track')->name('tracks.favorite');
        Route::delete('tracks/{track}/favorite', [MusicHubController::class, 'unfavorite'])->whereNumber('track')->name('tracks.unfavorite');
        Route::get('u/{user}', [MusicController::class, 'user'])->name('music.user');
        Route::get('search', [MusicController::class, 'search'])->middleware('throttle:120,1')->name('music.search');
        Route::post('now-playing', [NowPlayingController::class, 'store'])->middleware('throttle:60,1')->name('music.now-playing');
        Route::delete('now-playing', [NowPlayingController::class, 'destroy'])->name('music.now-playing.destroy');
        // GameCon Connect: пристрої користувача бачать, що грає на іншому, і керують ним.
        Route::post('connect/heartbeat', [MusicConnectController::class, 'heartbeat'])->middleware('throttle:music-connect')->name('music.connect.heartbeat');
        Route::post('connect/command', [MusicConnectController::class, 'command'])->middleware('throttle:60,1')->name('music.connect.command');

        Route::post('tracks', [TrackController::class, 'store'])->middleware('throttle:60,1')->name('tracks.store');
        // «Завантажити за посиланням»: файл завантажує сервер у фоні (ImportTrackFromUrl).
        Route::post('tracks/import', [TrackImportController::class, 'store'])->middleware('throttle:10,1')->name('tracks.import');
        Route::get('imports', [TrackImportController::class, 'index'])->name('music.imports.index');
        Route::delete('imports/{import}', [TrackImportController::class, 'destroy'])->whereNumber('import')->name('music.imports.destroy');
        Route::post('together', [ListenPartyController::class, 'store'])->middleware('throttle:10,1')->name('listen.store');
        // Кімнати «Слухати разом» для сім’ї, клану, спільноти чи друзів.
        Route::get('rooms', [ListenRoomController::class, 'index'])->name('music.rooms');
        Route::post('rooms', [ListenRoomController::class, 'store'])->middleware('throttle:10,1')->name('music.rooms.store');
        Route::get('rooms/{type}/{id}', [ListenRoomController::class, 'group'])->whereIn('type', ['family', 'clan', 'community'])->whereNumber('id')->name('music.rooms.group');
        Route::put('rooms/{type}/{id}/policy', [ListenRoomController::class, 'policy'])->whereIn('type', ['family', 'clan', 'community'])->whereNumber('id')->name('music.rooms.policy');
        Route::post('playlists', [PlaylistController::class, 'store'])->middleware('throttle:20,1')->name('playlists.store');

        Route::whereNumber(['track', 'playlist'])->group(function () {
            Route::patch('tracks/{track}', [TrackController::class, 'update'])->name('tracks.update');
            Route::delete('tracks/{track}', [TrackController::class, 'destroy'])->name('tracks.destroy');
            Route::get('tracks/{track}/download', [TrackController::class, 'download'])->name('tracks.download');
            Route::get('tracks/{track}/lyrics', [TrackController::class, 'lyrics'])->name('tracks.lyrics');
            Route::get('tracks/{track}/metadata', [TrackController::class, 'metadata'])->middleware('throttle:10,1')->name('tracks.metadata');
            Route::get('lyrics/find', [TrackController::class, 'findLyrics'])->middleware('throttle:60,1')->name('lyrics.find');
            Route::post('tracks/{track}/library', [TrackController::class, 'add'])->name('tracks.add');
            Route::delete('tracks/{track}/library', [TrackController::class, 'remove'])->name('tracks.remove');

            Route::get('playlists/{playlist}', [PlaylistController::class, 'show'])->name('playlists.show');
            Route::post('playlists/{playlist}', [PlaylistController::class, 'update'])->name('playlists.update');
            Route::delete('playlists/{playlist}', [PlaylistController::class, 'destroy'])->name('playlists.destroy');
            Route::post('playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'attach'])->name('playlists.attach');
            Route::delete('playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'detach'])->name('playlists.detach');
            Route::post('playlists/{playlist}/share', [PlaylistController::class, 'share'])->name('playlists.share');
            Route::post('playlists/{playlist}/spotify', [PlaylistController::class, 'importSpotify'])->name('playlists.spotify');
            Route::get('tracks/{track}/similar', [PlaylistController::class, 'similar'])->name('tracks.similar');
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
        Route::get('ten/{user:username}', [CinemaController::class, 'ten'])->name('ten');
        Route::post('ten', [CinemaController::class, 'toggleTen'])->name('ten.store');
        Route::post('ratings/{user:username}', [CinemaController::class, 'followRatings'])->name('ratings.follow');
        Route::put('playback', [CinemaController::class, 'playback'])->name('playback');
        Route::post('requests', [CinemaController::class, 'requestMovie'])->middleware('throttle:10,1')->name('requests.store');
        Route::get('search', [CinemaController::class, 'search'])->middleware('throttle:120,1')->name('search');
        Route::get('lookup', [CinemaController::class, 'lookup'])->middleware('throttle:10,1')->name('lookup');
        Route::get('{movie}', [CinemaController::class, 'show'])->name('show');
        Route::patch('{movie}/status', [CinemaController::class, 'status'])->middleware('throttle:60,1')->name('status');
        Route::put('{movie}/rating', [CinemaController::class, 'rate'])->middleware('throttle:60,1')->name('rate');
        Route::post('{movie}/started', [CinemaController::class, 'started'])->middleware('throttle:30,1')->name('started');
        Route::put('{movie}/progress', [CinemaController::class, 'progress'])->middleware('throttle:60,1')->name('progress');
        Route::get('{movie}/stream', [CinemaController::class, 'stream'])->middleware('throttle:60,1')->name('stream');
        Route::get('{movie}/episodes', [CinemaController::class, 'episodeList'])->middleware('throttle:60,1')->name('episodes.index');
        Route::post('{movie}/episodes', [CinemaController::class, 'episode'])->middleware('throttle:60,1')->name('episodes');
        Route::post('{movie}/soundtrack', [CinemaController::class, 'soundtrack'])->middleware('throttle:30,1')->name('soundtrack.store');
        Route::get('{movie}/comments', [CinemaController::class, 'comments'])->name('comments.index');
        Route::post('{movie}/comments', [CinemaController::class, 'comment'])->middleware('throttle:30,1')->name('comments.store');
        Route::post('{movie}/watch', [WatchPartyController::class, 'store'])->middleware('throttle:10,1')->name('watch.store');
    });

    // Статті: огляди, історії й гайди.
    Route::prefix('articles')->name('articles.')->middleware('module:articles')->group(function () {
        Route::get('/', [ArticleController::class, 'index'])->name('index');
        Route::get('create', [ArticleController::class, 'create'])->name('create');
        Route::post('/', [ArticleController::class, 'store'])->middleware('throttle:10,1')->name('store');
        Route::post('images', [ArticleController::class, 'image'])->middleware('throttle:30,1')->name('images');
        Route::get('{article}', [ArticleController::class, 'show'])->name('show');
        Route::get('{article}/edit', [ArticleController::class, 'edit'])->name('edit');
        Route::post('{article}', [ArticleController::class, 'update'])->middleware('throttle:20,1')->name('update');
        Route::delete('{article}', [ArticleController::class, 'destroy'])->name('destroy');
    });

    // Каталог мультиплеєрних ігор.
    Route::prefix('games')->name('games.')->middleware('module:games')->group(function () {
        Route::get('search', [GameController::class, 'search'])->middleware('throttle:120,1')->name('search');
        // Роздачі, бажане й знижки, «чи потягне мій ПК».
        Route::get('deals', [GameDealsController::class, 'index'])->name('deals');
        Route::post('deals/subscribe', [GameDealsController::class, 'subscribe'])->name('deals.subscribe');
        Route::get('pc', [GameDealsController::class, 'pcShow'])->name('pc.show');
        // Бэклог: «хочу — граю — пройшов — кинув».
        Route::get('backlog', [GameBacklogController::class, 'mine'])->name('backlog');
        Route::get('backlog/{user:username}', [GameBacklogController::class, 'show'])->name('backlog.user');
        Route::put('pc', [GameDealsController::class, 'pcSave'])->middleware('throttle:30,1')->name('pc.update');
        Route::get('{game}/prices', [GameDealsController::class, 'prices'])->middleware('throttle:60,1')->name('prices');
        Route::post('{game}/wish', [GameDealsController::class, 'wish'])->middleware('throttle:60,1')->name('wish');
        Route::get('{game}/pc-check', [GameDealsController::class, 'pcCheck'])->middleware('throttle:60,1')->name('pc-check');
        Route::post('{game}/rating', [GameRatingController::class, 'rate'])->middleware('throttle:30,1')->name('rating');
        Route::post('{game}/played', [GameRatingController::class, 'played'])->middleware('throttle:30,1')->name('played');
        Route::put('{game}/backlog', [GameBacklogController::class, 'update'])->middleware('throttle:60,1')->name('backlog.update');
        Route::get('{game}/wallpapers/{index}', [GameWallpaperController::class, 'download'])->whereNumber('index')->middleware('throttle:30,1')->name('wallpapers.download');
        Route::get('{game}/playlists/mine', [GameSoundtrackController::class, 'mine'])->name('playlists.mine');
        Route::post('{game}/playlists', [GameSoundtrackController::class, 'store'])->middleware('throttle:20,1')->name('playlists.store');
        Route::delete('{game}/playlists/{playlist}', [GameSoundtrackController::class, 'destroy'])->whereNumber('playlist')->name('playlists.destroy');
        Route::post('{game}/collections', [GameController::class, 'collections'])->name('collections');
        Route::post('{game}/guides', [GameController::class, 'guide'])->middleware('throttle:20,1')->name('guides.store');
        Route::delete('{game}/guides/{guide}', [GameController::class, 'deleteGuide'])->whereNumber('guide')->name('guides.destroy');
    });

    // Клани й гільдії мультиплеєрних ігор.
    Route::prefix('clans')->name('clans.')->middleware('module:clans')->group(function () {
        Route::get('/', [ClanController::class, 'index'])->name('index');
        Route::get('create', [ClanController::class, 'create'])->name('create');
        Route::post('/', [ClanController::class, 'store'])->middleware('throttle:10,1')->name('store');
        Route::prefix('{clan}')->group(function () {
            Route::get('/', [ClanController::class, 'show'])->name('show');
            Route::post('join', [ClanController::class, 'join'])->middleware('throttle:20,1')->name('join');
            Route::post('invite-link', [InviteLinkController::class, 'clan'])->middleware('throttle:20,1')->name('invite-link');
            Route::post('leave', [ClanController::class, 'leave'])->name('leave');
            Route::post('members/{member}', [ClanController::class, 'member'])->whereNumber('member')->name('members.update');
            Route::post('members/{member}/nudge', [ClanController::class, 'nudge'])->whereNumber('member')->middleware('throttle:20,1')->name('members.nudge');
            Route::post('settings', [ClanController::class, 'update'])->name('update');
            Route::post('allies', [ClanController::class, 'ally'])->name('allies.store');
            Route::post('allies/{alliance}/accept', [ClanController::class, 'acceptAlly'])->whereNumber('alliance')->name('allies.accept');
            Route::post('matches', [ClanController::class, 'match'])->name('matches.store');
            Route::post('news', [ClanController::class, 'news'])->middleware('throttle:20,1')->name('news.store');
            Route::delete('news/{news}', [ClanController::class, 'deleteNews'])->whereNumber('news')->name('news.destroy');
            Route::post('events', [ClanController::class, 'event'])->middleware('throttle:20,1')->name('events.store');
            Route::post('events/{event}/bracket', [ClanController::class, 'bracket'])->whereNumber('event')->middleware('throttle:30,1')->name('events.bracket');
            Route::post('events/{event}/rsvp', [ClanController::class, 'rsvp'])->whereNumber('event')->name('events.rsvp');
            Route::delete('events/{event}', [ClanController::class, 'deleteEvent'])->whereNumber('event')->name('events.destroy');
            Route::post('contributions', [ClanController::class, 'contribute'])->middleware('throttle:30,1')->name('contributions.store');
            Route::post('contributions/{contribution}', [ClanController::class, 'review'])->whereNumber('contribution')->name('contributions.review');
            Route::post('spend', [ClanController::class, 'spend'])->middleware('throttle:30,1')->name('spend');
            Route::get('chat', [ClanController::class, 'chat'])->name('chat');
        });
    });

    // Спільний перегляд: доступ за посиланням із кодом.
    Route::prefix('watch/{party}')->name('watch.')->middleware('module:cinema')->group(function () {
        Route::get('/', [WatchPartyController::class, 'show'])->name('show');
        Route::get('state', [WatchPartyController::class, 'poll'])->name('poll');
        Route::post('state', [WatchPartyController::class, 'control'])->middleware('throttle:240,1')->name('control');
        Route::post('shared', [WatchPartyController::class, 'shared'])->name('shared');
        Route::post('messages', [WatchPartyController::class, 'message'])->middleware('throttle:30,1')->name('messages');
        Route::post('voice', [WatchPartyController::class, 'voice'])->middleware('throttle:20,1')->name('voice');
        Route::post('invite', [WatchPartyController::class, 'invite'])->middleware('throttle:10,1')->name('invite');
        Route::delete('/', [WatchPartyController::class, 'end'])->name('end');
    });

    // «Перекласти» під записами, коментарями й повідомленнями (DeepL).
    Route::post('translate', TranslateController::class)->middleware('throttle:60,1')->name('translate');

    // Календар подій: сім’ї, клани, сервери, ігри.
    Route::prefix('events')->name('events.')->middleware('module:events')->group(function () {
        Route::get('/', [EventController::class, 'index'])->name('index');
        Route::get('releases', [EventController::class, 'releases'])->name('releases');
        Route::put('reminder', [EventController::class, 'reminder'])->name('reminder');
        Route::get('{kind}/{id}.ics', [EventController::class, 'calendarFile'])->whereIn('kind', ['family', 'clan', 'server', 'game'])->whereNumber('id')->name('ics');
        Route::post('server/{server}', [EventController::class, 'storeServer'])->middleware('throttle:20,1')->name('server.store');
        Route::post('server/{event}/rsvp', [EventController::class, 'rsvpServer'])->whereNumber('event')->name('server.rsvp');
        Route::delete('server/{event}', [EventController::class, 'destroyServer'])->whereNumber('event')->name('server.destroy');
        Route::post('game/{game}', [EventController::class, 'storeGame'])->middleware('throttle:20,1')->name('game.store');
        Route::post('game/{event}/rsvp', [EventController::class, 'rsvpGame'])->whereNumber('event')->name('game.rsvp');
        Route::delete('game/{event}', [EventController::class, 'destroyGame'])->whereNumber('event')->name('game.destroy');
    });

    // Спільне прослуховування: доступ за посиланням із кодом.
    Route::prefix('listen/{party}')->name('listen.')->middleware('module:music')->group(function () {
        Route::get('/', [ListenPartyController::class, 'show'])->name('show');
        Route::get('state', [ListenPartyController::class, 'poll'])->name('poll');
        Route::post('state', [ListenPartyController::class, 'control'])->middleware('throttle:240,1')->name('control');
        Route::post('queue', [ListenPartyController::class, 'enqueue'])->middleware('throttle:60,1')->name('queue');
        Route::delete('queue/{index}', [ListenPartyController::class, 'dequeue'])->whereNumber('index')->name('dequeue');
        Route::post('next', [ListenPartyController::class, 'next'])->middleware('throttle:60,1')->name('next');
        Route::post('repeat', [ListenPartyController::class, 'repeat'])->name('repeat');
        Route::post('shared', [ListenPartyController::class, 'shared'])->name('shared');
        Route::post('invite', [ListenPartyController::class, 'invite'])->middleware('throttle:10,1')->name('invite');
        Route::post('share', [ListenPartyController::class, 'share'])->middleware('throttle:10,1')->name('share');
        Route::post('suggest', [ListenRoomController::class, 'suggest'])->middleware('throttle:30,1')->name('suggest');
        Route::post('suggestions/{index}', [ListenRoomController::class, 'review'])->whereNumber('index')->middleware('throttle:60,1')->name('review');
        Route::post('react', [ListenRoomController::class, 'react'])->middleware('throttle:40,1')->name('react');
        Route::post('chat', [ListenRoomController::class, 'chat'])->middleware('throttle:30,1')->name('chat');
        Route::post('kick', [ListenRoomController::class, 'kick'])->middleware('throttle:30,1')->name('kick');
        Route::post('host', [ListenRoomController::class, 'host'])->middleware('throttle:20,1')->name('host');
        Route::delete('/', [ListenPartyController::class, 'end'])->name('end');
    });

    Route::prefix('servers')->name('servers.')->middleware('module:servers')->group(function () {
        Route::get('/', [ServerController::class, 'index'])->name('index');
        Route::get('compare', [ServerController::class, 'compare'])->name('compare');
        Route::post('suggest', [ServerController::class, 'suggest'])->middleware('throttle:5,10')->name('suggest');
        Route::get('{server}', [ServerController::class, 'show'])->name('show');
        Route::post('{server}/invite', [ServerController::class, 'invite'])->middleware('throttle:20,1')->name('invite');
        Route::post('{server}/claim', [ServerController::class, 'claim'])->middleware('throttle:10,1')->name('claim');
        Route::post('{server}/claims/{claim}', [ServerController::class, 'decideClaim'])->name('claims.decide');
        Route::post('{server}/news', [ServerController::class, 'news'])->middleware('throttle:20,1')->name('news.store');
        Route::post('{server}/tags', [ServerController::class, 'tags'])->name('tags');
        Route::post('{server}/reviews', [ServerController::class, 'review'])->middleware('throttle:20,1')->name('reviews.store');
        Route::post('{server}/vote', [ServerController::class, 'vote'])->middleware('throttle:10,1')->name('vote');
        Route::post('{server}/click', [ServerController::class, 'click'])->middleware('throttle:60,1')->name('click');
        Route::post('{server}/apps', [ServerAppController::class, 'store'])->middleware('throttle:10,1')->name('apps.store');
        Route::patch('{server}/apps/{app}', [ServerAppController::class, 'update'])->name('apps.update');
        Route::post('{server}/apps/{app}/secret', [ServerAppController::class, 'secret'])->middleware('throttle:10,1')->name('apps.secret');
        Route::delete('{server}/apps/{app}', [ServerAppController::class, 'destroy'])->name('apps.destroy');
    });

    // Турніри й челенджі серверів (плагін server_tournaments).
    Route::post('servers/{server}/tournaments', [TournamentController::class, 'store'])->middleware(['module:servers', 'throttle:10,10'])->name('servers.tournaments.store');
    Route::prefix('tournaments')->name('tournaments.')->middleware('module:servers')->whereNumber(['tournament', 'match', 'submission'])->group(function () {
        Route::get('/', [TournamentController::class, 'index'])->name('index');
        Route::get('{tournament}', [TournamentController::class, 'show'])->name('show');
        Route::post('{tournament}/join', [TournamentController::class, 'join'])->middleware('throttle:20,1')->name('join');
        Route::delete('{tournament}/join', [TournamentController::class, 'leave'])->name('leave');
        Route::post('{tournament}/start', [TournamentController::class, 'start'])->name('start');
        Route::post('{tournament}/matches/{match}', [TournamentController::class, 'report'])->middleware('throttle:60,1')->name('report');
        Route::post('{tournament}/submissions', [TournamentController::class, 'submit'])->middleware('throttle:10,1')->name('submit');
        Route::post('{tournament}/submissions/{submission}', [TournamentController::class, 'review'])->middleware('throttle:120,1')->name('review');
        Route::post('{tournament}/finish', [TournamentController::class, 'finish'])->name('finish');
        Route::delete('{tournament}', [TournamentController::class, 'destroy'])->name('destroy');
    });

    Route::get('wrapped', [WrappedController::class, 'show'])->middleware('throttle:30,1')->name('wrapped');

    Route::prefix('quests')->name('quests.')->middleware('module:quests')->group(function () {
        Route::get('/', [QuestController::class, 'index'])->name('index');
        Route::post('{quest}/claim', [QuestController::class, 'claim'])->where('quest', '[a-z]{2,24}')->middleware('throttle:30,1')->name('claim');
    });

    // Сезонний пропуск: рівні з очок сезону, нагороди двох доріжок, інвентар косметики.
    Route::prefix('season')->name('season.')->middleware('module:quests')->group(function () {
        Route::get('/', [SeasonController::class, 'index'])->name('index');
        Route::post('levels/{level}/{track}/claim', [SeasonController::class, 'claim'])->whereNumber('level')->whereIn('track', ['free', 'plus'])->middleware('throttle:60,1')->name('claim');
        Route::post('equip', [SeasonController::class, 'equip'])->middleware('throttle:60,1')->name('equip');
    });

    Route::prefix('moments')->name('moments.')->middleware('module:moments')->whereNumber('moment')->group(function () {
        Route::get('/', [MomentController::class, 'index'])->name('index');
        Route::post('/', [MomentController::class, 'store'])->middleware('throttle:10,60')->name('store');
        Route::post('{moment}/like', [MomentController::class, 'like'])->middleware('throttle:120,1')->name('like');
        Route::delete('{moment}', [MomentController::class, 'destroy'])->name('destroy');
    });

    Route::prefix('party')->name('party.')->middleware('module:party')->whereNumber('party')->group(function () {
        Route::get('/', [PartyController::class, 'index'])->name('index');
        Route::post('/', [PartyController::class, 'store'])->middleware('throttle:10,10')->name('store');
        Route::get('match', [TeammateController::class, 'index'])->name('match');
        Route::put('match/profile', [TeammateController::class, 'update'])->middleware('throttle:20,1')->name('match.profile');
        Route::post('match/looking', [TeammateController::class, 'looking'])->middleware('throttle:20,1')->name('match.looking');
        Route::post('{party}/invite', [TeammateController::class, 'invite'])->middleware('throttle:30,1')->name('invite');
        Route::get('{party}', [PartyController::class, 'show'])->name('show');
        Route::post('{party}/join', [PartyController::class, 'join'])->middleware('throttle:20,1')->name('join');
        Route::post('{party}/time', [PartyController::class, 'voteTime'])->middleware('throttle:30,1')->name('time.vote');
        Route::post('{party}/time/{slot}', [PartyController::class, 'pickTime'])->whereNumber('slot')->middleware('throttle:10,1')->name('time.pick');
        Route::post('{party}/invite-link', [InviteLinkController::class, 'party'])->middleware('throttle:20,1')->name('invite-link');
        Route::delete('{party}/join', [PartyController::class, 'leave'])->name('leave');
        Route::post('{party}/bump', [PartyController::class, 'bump'])->middleware('throttle:10,1')->name('bump');
        Route::delete('{party}', [PartyController::class, 'close'])->name('close');
    });

    Route::prefix('characters')->name('characters.')->middleware('module:servers')->whereNumber('character')->group(function () {
        Route::get('create', [CharacterController::class, 'create'])->name('create');
        Route::post('/', [CharacterController::class, 'store'])->middleware('throttle:10,1')->name('store');
        Route::get('{character}', [CharacterController::class, 'show'])->name('show');
        Route::get('{character}/edit', [CharacterController::class, 'edit'])->name('edit');
        Route::post('{character}', [CharacterController::class, 'update'])->middleware('throttle:20,1')->name('update');
        Route::delete('{character}', [CharacterController::class, 'destroy'])->name('destroy');
        Route::post('{character}/photos', [CharacterController::class, 'addPhoto'])->middleware('throttle:20,1')->name('photos.store');
        Route::delete('{character}/photos/{index}', [CharacterController::class, 'removePhoto'])->whereNumber('index')->name('photos.destroy');
    });

    Route::middleware('module:families')->group(function () {
        Route::get('families', [Families\FamilyController::class, 'index'])->name('families.index');
        Route::get('families/create', [Families\FamilyController::class, 'create'])->name('families.create');
        Route::post('families', [Families\FamilyController::class, 'store'])->middleware('throttle:5,10')->name('families.store');

        Route::prefix('f/{family}')->name('families.')->scopeBindings()->group(function () {
            Route::get('/', [Families\FamilyController::class, 'show'])->name('show');
            Route::post('apply', [Families\FamilyController::class, 'apply'])->middleware('throttle:10,10')->name('apply');
            Route::post('block', [Families\FamilyController::class, 'block'])->middleware('throttle:20,1')->name('block');
            Route::delete('block/{user}', [Families\FamilyController::class, 'unblock'])->withoutScopedBindings()->name('unblock');
            Route::post('invite-link', [InviteLinkController::class, 'family'])->middleware('throttle:20,1')->name('invite-link');
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
                Route::post('members/{member}/nudge', [Families\FamilyMemberController::class, 'nudge'])->middleware('throttle:20,1')->name('members.nudge');
            });

            Route::get('discipline', [Families\FamilyDisciplineController::class, 'index'])->name('discipline');
            Route::post('discipline', [Families\FamilyDisciplineController::class, 'store'])->middleware('throttle:30,1')->name('discipline.store');
            Route::post('discipline/{punishment}/revoke', [Families\FamilyDisciplineController::class, 'revoke'])->whereNumber('punishment')->name('discipline.revoke');

            Route::get('events', [Families\FamilyEventController::class, 'index'])->name('events');
            Route::post('events', [Families\FamilyEventController::class, 'store'])->middleware('throttle:20,1')->name('events.store');
            Route::post('events/{event}/rsvp', [Families\FamilyEventController::class, 'rsvp'])->whereNumber('event')->name('events.rsvp');
            Route::post('events/{event}/close', [Families\FamilyEventController::class, 'close'])->whereNumber('event')->name('events.close');
            Route::post('events/{event}/checkin', [Families\FamilyEventController::class, 'checkIn'])->whereNumber('event')->middleware('throttle:10,1')->name('events.checkin');
            Route::post('events/{event}/album', [Families\FamilyEventController::class, 'album'])->whereNumber('event')->middleware('throttle:10,1')->name('events.album');
            Route::get('rating', [Families\FamilyEventController::class, 'rating'])->name('rating');
            Route::post('rating/season', [Families\FamilyEventController::class, 'endSeason'])->middleware('throttle:5,1')->name('rating.season');

            Route::get('audit', [Families\FamilyAuditController::class, 'index'])->name('audit');

            Route::get('settings', [Families\FamilySettingsController::class, 'index'])->name('settings');
            Route::post('settings/profile', [Families\FamilySettingsController::class, 'profile'])->name('settings.profile');
            Route::put('settings', [Families\FamilySettingsController::class, 'update'])->name('settings.update');
            Route::put('settings/webhooks', [Families\FamilySettingsController::class, 'webhooks'])->name('settings.webhooks');
            Route::put('settings/jar', [Families\FamilySettingsController::class, 'jar'])->name('settings.jar');
            Route::post('settings/webhooks/test', [Families\FamilySettingsController::class, 'test'])->middleware('throttle:6,1')->name('settings.webhooks.test');
            Route::post('settings/digest', [Families\FamilySettingsController::class, 'digest'])->middleware('throttle:3,10')->name('settings.digest');
        });
    });

    Route::get('people', [PeopleController::class, 'index'])->middleware('module:people')->name('people.index');
    Route::post('people/saved', [PeopleController::class, 'saveSearch'])->name('people.saved');
    Route::get('search/quick', [PeopleController::class, 'quick'])->middleware('throttle:120,1')->name('search.quick');
    Route::post('search/recent', [PeopleController::class, 'remember'])->middleware('throttle:60,1')->name('search.recent');

    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read', [NotificationController::class, 'markAllRead'])->name('notifications.read');

    Route::get('me', [ProfileController::class, 'me'])->name('profile.me');
    // Швидкий статус з емодзі й таймером.
    // «Готовий грати зараз».
    Route::get('ready', [ReadyToPlayController::class, 'show'])->name('ready.show');
    Route::put('ready', [ReadyToPlayController::class, 'update'])->middleware('throttle:30,1')->name('ready.update');
    Route::delete('ready', [ReadyToPlayController::class, 'destroy'])->name('ready.destroy');
    Route::put('me/status', [StatusController::class, 'update'])->middleware('throttle:30,1')->name('status.update');
    Route::delete('me/status', [StatusController::class, 'destroy'])->name('status.destroy');
    // «Граю в…»: ручний статус, автоматичний (Discord, Steam, телефон).
    Route::prefix('me/playing')->name('playing.')->group(function () {
        Route::get('/', [PlayingController::class, 'show'])->name('show');
        Route::get('search', [PlayingController::class, 'search'])->middleware('throttle:120,1')->name('search');
        Route::put('/', [PlayingController::class, 'update'])->middleware('throttle:30,1')->name('update');
        Route::delete('/', [PlayingController::class, 'destroy'])->name('destroy');
        Route::put('auto', [PlayingController::class, 'auto'])->name('auto');
        Route::post('steam', [PlayingController::class, 'linkSteam'])->middleware('throttle:10,1')->name('steam');
        Route::put('consoles', [PlayingController::class, 'consoles'])->middleware('throttle:20,1')->name('consoles');
        Route::delete('steam', [PlayingController::class, 'unlinkSteam'])->name('steam.destroy');
    });
    Route::post('me/avatar', [ProfileController::class, 'updateAvatar'])->name('profile.avatar');
    Route::delete('me/avatar', [ProfileController::class, 'destroyAvatar'])->name('profile.avatar.destroy');
    Route::post('me/cover', [ProfileController::class, 'updateCover'])->name('profile.cover');
    Route::post('me/pin', [ProfileController::class, 'pin'])->name('profile.pin');
    Route::post('me/together', [ProfileController::class, 'together'])->middleware('throttle:30,1')->name('profile.together');

    // Перевірка орфографії для адміністрації й модераторів (права — в контролері).
    Route::post('admin/spellcheck', [Admin\SpellcheckController::class, 'check'])->middleware('throttle:60,1')->name('admin.spellcheck');
    Route::post('admin/spellcheck/words', [Admin\SpellcheckController::class, 'addWord'])->middleware('throttle:30,1')->name('admin.spellcheck.words');
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
        Route::post('music/enrich', [Admin\MusicController::class, 'enrich'])->middleware('throttle:10,1')->name('music.enrich');
        Route::post('music/metadata/check', [Admin\MusicController::class, 'checkMetadata'])->middleware('throttle:10,1')->name('music.metadata.check');
        Route::delete('music/{track}', [Admin\MusicController::class, 'destroy'])->whereNumber('track')->name('music.destroy');
        Route::post('music/{track}/restore', [Admin\MusicController::class, 'restore'])->whereNumber('track')->name('music.restore');
        // Радіостанції й добірки редакції для розділу «Музика».
        Route::prefix('music/radio')->name('music.radio.')->controller(Admin\MusicRadioController::class)->group(function () {
            Route::get('/', 'stations')->name('index');
            Route::post('/', 'storeStation')->name('store');
            Route::whereNumber('station')->group(function () {
                Route::post('{station}', 'updateStation')->name('update');
                Route::patch('{station}/flags', 'flagStation')->name('flags');
                Route::post('{station}/probe', 'probeStation')->middleware('throttle:20,1')->name('probe');
                Route::delete('{station}', 'destroyStation')->name('destroy');
            });
        });
        Route::get('music/featured', [Admin\MusicFeaturedController::class, 'featured'])->name('music.featured.index');
        Route::patch('music/featured/{playlist}', [Admin\MusicFeaturedController::class, 'feature'])->whereNumber('playlist')->name('music.featured.update');
        Route::prefix('cinema')->name('cinema.')->group(function () {
            Route::get('/', [Admin\CinemaController::class, 'index'])->name('index');
            Route::get('create', [Admin\CinemaController::class, 'create'])->name('create');
            Route::post('/', [Admin\CinemaController::class, 'store'])->name('store');
            Route::get('import', [Admin\CinemaController::class, 'import'])->name('import');
            Route::put('auto', [Admin\CinemaController::class, 'updateAuto'])->name('auto.update');
            Route::put('players', [Admin\CinemaController::class, 'updatePlayers'])->name('players.update');
            Route::post('players/bulk', [Admin\CinemaController::class, 'bulkPlayers'])->middleware('throttle:10,1')->name('players.bulk');
            Route::delete('players/bulk', [Admin\CinemaController::class, 'cancelBulkPlayers'])->name('players.bulk.cancel');
            Route::put('tmdb', [Admin\CinemaController::class, 'updateTmdb'])->name('tmdb.update');
            Route::delete('requests', [Admin\CinemaController::class, 'closeRequest'])->name('requests.close');
            Route::post('auto/run', [Admin\CinemaController::class, 'runAuto'])->middleware('throttle:10,1')->name('auto.run');
            Route::middleware('throttle:60,1')->group(function () {
                Route::get('remote/{provider}/search', [Admin\CinemaController::class, 'remoteSearch'])->whereIn('provider', ['kodik', 'flixcdn', 'videoseed'])->name('remote.search');
                Route::get('remote/{provider}/latest', [Admin\CinemaController::class, 'remoteLatest'])->whereIn('provider', ['kodik', 'flixcdn', 'videoseed'])->name('remote.latest');
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
                Route::patch('{movie}/sources/{source}', [Admin\CinemaController::class, 'toggleSource'])->name('sources.toggle');
            });
        });
        Route::get('integrations', [Admin\IntegrationController::class, 'index'])->name('integrations.index');
        Route::put('integrations/cinema/{provider}', [Admin\IntegrationController::class, 'updateCinema'])->name('integrations.cinema');
        Route::post('integrations/cinema/{provider}/test', [Admin\IntegrationController::class, 'testCinema'])->middleware('throttle:20,1')->name('integrations.cinema.test');
        Route::put('integrations/spotify', [Admin\IntegrationController::class, 'updateSpotify'])->name('integrations.spotify');
        Route::post('integrations/spotify/test', [Admin\IntegrationController::class, 'testSpotify'])->middleware('throttle:10,1')->name('integrations.spotify.test');
        Route::prefix('plus')->name('plus.')->group(function () {
            Route::get('/', [Admin\PlusController::class, 'index'])->name('index');
            Route::post('grants', [Admin\PlusController::class, 'grant'])->name('grant');
            Route::delete('grants/{grant}', [Admin\PlusController::class, 'revoke'])->whereNumber('grant')->name('revoke');
            Route::post('codes', [Admin\PlusController::class, 'storeCode'])->name('codes.store');
            Route::delete('codes/{code}', [Admin\PlusController::class, 'destroyCode'])->whereNumber('code')->name('codes.destroy');
        });
        Route::prefix('billing')->name('billing.')->controller(Admin\BillingController::class)->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('orders/{order}/refund', 'refundOrder')->whereNumber('order')->name('orders.refund');
            Route::post('payments/{payment}/refund', 'refund')->whereNumber('payment')->name('payments.refund');
            Route::post('adjust', 'adjust')->name('adjust');
            Route::put('products', 'products')->name('products');
            Route::put('rules', 'rules')->name('rules');
            Route::put('google-pay', 'googlePay')->name('google-pay');
        });
        Route::get('seasons', [Admin\SeasonController::class, 'index'])->name('seasons.index');
        Route::put('seasons/{key}', [Admin\SeasonController::class, 'update'])->where('key', '\d{4}-\d{2}')->name('seasons.update');
        Route::get('stickers', [Admin\StickerController::class, 'index'])->name('stickers.index');
        Route::post('stickers', [Admin\StickerController::class, 'store'])->name('stickers.store');
        Route::patch('stickers/{pack}', [Admin\StickerController::class, 'update'])->name('stickers.update');
        Route::delete('stickers/{pack}', [Admin\StickerController::class, 'destroy'])->name('stickers.destroy');
        Route::post('stickers/{pack}/items', [Admin\StickerController::class, 'upload'])->name('stickers.upload');
        Route::delete('stickers/{pack}/items/{sticker}', [Admin\StickerController::class, 'destroySticker'])->scopeBindings()->name('stickers.items.destroy');
        Route::prefix('phones')->name('phones.')->controller(Admin\PhoneNumbersController::class)->group(function () {
            Route::get('/', 'index')->name('index');
            Route::put('/', 'update')->name('update');
            Route::post('rules', 'storeRule')->name('rules.store');
            Route::delete('rules/{rule}', 'destroyRule')->whereNumber('rule')->name('rules.destroy');
            Route::delete('numbers/{number}', 'destroyNumber')->whereNumber('number')->name('numbers.destroy');
        });
        Route::get('modes', [Admin\ModesController::class, 'index'])->name('modes.index');
        Route::put('modes', [Admin\ModesController::class, 'update'])->name('modes.update');
        Route::post('modes/reset', [Admin\ModesController::class, 'reset'])->name('modes.reset');
        Route::prefix('design')->name('design.')->controller(Admin\DesignController::class)->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('template', 'template')->name('template');
            Route::post('/', 'store')->middleware('throttle:30,1')->name('store');
            Route::post('reset', 'reset')->name('reset');
            Route::post('seasonal', 'seasonal')->name('seasonal');
            Route::post('background', 'background')->middleware('throttle:30,1')->name('background');
            Route::delete('background/{kind}', 'deleteBackground')->whereIn('kind', ['desktop', 'mobile'])->name('background.destroy');
            Route::whereNumber('theme')->group(function () {
                Route::post('{theme}', 'update')->middleware('throttle:30,1')->name('update');
                Route::post('{theme}/activate', 'activate')->name('activate');
                Route::delete('{theme}', 'destroy')->name('destroy');
            });
        });
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
        Route::prefix('games')->name('games.')->group(function () {
            Route::get('/', [Admin\GameController::class, 'index'])->name('index');
            Route::put('features', [Admin\GameController::class, 'features'])->name('features');
            Route::post('sync', [Admin\GameController::class, 'sync'])->middleware('throttle:5,1')->name('sync');
            Route::patch('{game:id}', [Admin\GameController::class, 'update'])->whereNumber('game')->name('update');
        });
        Route::prefix('geo')->name('geo.')->group(function () {
            Route::get('/', [Admin\GeoController::class, 'index'])->name('index');
            Route::put('/', [Admin\GeoController::class, 'update'])->name('update');
            Route::put('maxmind', [Admin\GeoController::class, 'maxmind'])->name('maxmind');
            Route::post('refresh', [Admin\GeoController::class, 'refresh'])->middleware('throttle:5,1')->name('refresh');
            Route::get('restrictions', [Admin\GeoRestrictionController::class, 'index'])->name('restrictions.index');
            Route::put('restrictions/{country}', [Admin\GeoRestrictionController::class, 'update'])->where('country', '[A-Z]{2}')->name('restrictions.update');
            Route::get('restrictions/{country}/recommendations', [Admin\GeoRestrictionController::class, 'recommendations'])->where('country', '[A-Z]{2}')->name('restrictions.recommendations');
        });
        Route::prefix('languages')->name('languages.')->group(function () {
            Route::get('/', [Admin\LanguageController::class, 'index'])->name('index');
            Route::post('/', [Admin\LanguageController::class, 'store'])->name('store');
            Route::put('settings', [Admin\LanguageController::class, 'settings'])->name('settings');
            Route::post('libretranslate/test', [Admin\LanguageController::class, 'testLibre'])->middleware('throttle:20,1')->name('libretranslate.test');
            Route::post('deepl/refresh', [Admin\LanguageController::class, 'refreshDeepl'])->middleware('throttle:20,1')->name('deepl.refresh');
            Route::where(['code' => '[A-Za-z]{2,3}(-[A-Za-z0-9]{2,4}){0,2}'])->group(function () {
                Route::patch('{code}', [Admin\LanguageController::class, 'update'])->name('update');
                Route::delete('{code}', [Admin\LanguageController::class, 'destroy'])->name('destroy');
                Route::post('{code}/translate', [Admin\LanguageController::class, 'translate'])->middleware('throttle:10,1')->name('translate');
                Route::get('{code}/strings', [Admin\LanguageController::class, 'strings'])->name('strings');
                Route::put('{code}/strings', [Admin\LanguageController::class, 'updateString'])->name('strings.update');
            });
        });
        Route::prefix('moderation')->name('moderation.')->group(function () {
            Route::get('/', [Admin\ModerationController::class, 'index'])->name('index');
            Route::put('settings', [Admin\ModerationController::class, 'settings'])->name('settings');
            Route::post('reports/{report}', [Admin\ModerationController::class, 'resolve'])->whereNumber('report')->name('resolve');
            Route::post('users/{user:id}/unmute', [Admin\ModerationController::class, 'unmute'])->whereNumber('user')->name('unmute');
            Route::post('people/{user:id}', [Admin\ModerationController::class, 'resolvePerson'])->whereNumber('user')->name('people.resolve');
            Route::post('appeals/{appeal}', [Admin\ModerationController::class, 'answerAppeal'])->whereNumber('appeal')->name('appeals.answer');
            Route::post('feedback/{feedback}', [Admin\ModerationController::class, 'readFeedback'])->whereNumber('feedback')->name('feedback.read');
            Route::post('images/{flag}', [Admin\ModerationController::class, 'resolveImage'])->whereNumber('flag')->name('images.resolve');
        });
        Route::get('families', [Admin\FamilyController::class, 'index'])->name('families.index');
        Route::patch('families/{family:id}', [Admin\FamilyController::class, 'update'])->whereNumber('family')->name('families.update');
        Route::post('families/voice-rooms', [Admin\VoiceTemplateController::class, 'store'])->name('voice-templates.store');
        Route::patch('families/voice-rooms/{template}', [Admin\VoiceTemplateController::class, 'update'])->name('voice-templates.update');
        Route::delete('families/voice-rooms/{template}', [Admin\VoiceTemplateController::class, 'destroy'])->name('voice-templates.destroy');
        Route::get('plugins', [Admin\PluginController::class, 'index'])->name('plugins.index');
        Route::patch('plugins/{plugin}', [Admin\PluginController::class, 'update'])->name('plugins.update');
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

// Каталог і сторінки ігор відкриті гостям і пошуковикам; дії з грою — лише після входу (вище).
Route::prefix('games')->name('games.')->middleware('module:games')->group(function () {
    Route::get('/', [GameController::class, 'index'])->name('index');
    Route::get('{game}', [GameController::class, 'show'])->name('show');
});

Route::middleware('module:communities')->group(function () {
    // Каталог спільнот відкритий і гостям; гостьова сторінка й гостьовий чат — для відвідувачів без акаунта.
    Route::get('communities', [CommunityController::class, 'index'])->name('communities.index');
    Route::get('c/{community}/guest', [CommunityGuestController::class, 'show'])->name('communities.guest');
    Route::post('c/{community}/guest/{channel}', [CommunityGuestController::class, 'store'])->whereNumber('channel')->middleware('throttle:6,1')->name('communities.guest.store');
    Route::get('widget/{community}', [CommunityWidgetController::class, 'show'])->name('communities.widget');
    Route::get('widget/{community}/card.js', [CommunityWidgetController::class, 'script'])->name('communities.widget.script');
});

Route::get('{user}/card', [ProfileController::class, 'card'])
    ->where('user', '[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9]')
    ->name('profile.card');
Route::get('id{id}', [ProfileController::class, 'byId'])->whereNumber('id')->name('profile.id');
Route::get('{user}', [ProfileController::class, 'show'])
    ->where('user', '[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9]')
    ->name('profile.show');
