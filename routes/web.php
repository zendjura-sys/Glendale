<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\CommunityMemberController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\FriendController;
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
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\TrackController;
use App\Http\Controllers\WelcomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', WelcomeController::class)->name('home');

Route::redirect('dashboard', '/feed')->name('dashboard');

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
            Route::get('callback', [SpotifyController::class, 'callback'])->name('callback');
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
        Route::get('integrations', [Admin\IntegrationController::class, 'index'])->name('integrations.index');
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
        Route::get('modules', [Admin\ModuleController::class, 'index'])->name('modules.index');
        Route::patch('modules/{module}', [Admin\ModuleController::class, 'update'])->name('modules.update');
        Route::get('settings', [Admin\SettingsController::class, 'edit'])->name('settings.edit');
        Route::put('settings', [Admin\SettingsController::class, 'update'])->name('settings.update');
    });
});

require __DIR__.'/settings.php';

Route::get('id{id}', [ProfileController::class, 'byId'])->whereNumber('id')->name('profile.id');
Route::get('{user}', [ProfileController::class, 'show'])
    ->where('user', '[A-Za-z][A-Za-z0-9_.]{1,30}[A-Za-z0-9]')
    ->name('profile.show');
