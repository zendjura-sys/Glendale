<?php

namespace App\Http\Controllers;

use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\Messenger;
use App\Services\MusicService;
use App\Services\PhotoService;
use App\Services\PostPresenter;
use App\Support\Modules\ModuleManager;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly ImageStorage $images,
    ) {}

    public function me(Request $request): RedirectResponse
    {
        return to_route('profile.show', $request->user());
    }

    public function byId(int $id): RedirectResponse
    {
        return to_route('profile.show', User::query()->findOrFail($id), 301);
    }

    public function show(Request $request, User $user, Messenger $messenger, ModuleManager $modules, PhotoService $photoService): Response
    {
        $viewer = $request->user();
        $relation = $this->friendships->status($viewer, $user);
        $canSeeContent = ! $user->is_private || in_array($relation, [FriendshipService::SELF, FriendshipService::FRIENDS], true) || $viewer?->isStaff();
        $friendIds = $this->friendships->friendIds($user);
        $viewerFriendIds = $viewer ? $this->friendships->friendIds($viewer) : [];

        $posts = Post::query()
            ->where('wall_type', $user->getMorphClass())
            ->where('wall_id', $user->id)
            ->visibleTo($viewer, $viewerFriendIds)
            ->orderByDesc('is_pinned')
            ->orderByDesc('id')
            ->cursorPaginate(FeedController::PER_PAGE);

        $items = $canSeeContent ? $this->presenter->many(new Collection($posts->items()), $viewer) : [];

        if ($modules->enabled('photos')) {
            $photoQuery = Photo::query()->whereIn('album_id', $viewer
                ? $photoService->visibleAlbums($user, $viewer)->select('id')
                : PhotoAlbum::query()->whereMorphedTo('owner', $user)->where('privacy', PhotoAlbum::PRIVACY_PUBLIC)->select('id'));
            $photoCount = (clone $photoQuery)->count();
            $photoItems = $canSeeContent ? $photoQuery->latest('id')->limit(6)->get()->map(fn (Photo $photo) => [
                'id' => $photo->id,
                'url' => $photo->url,
                'href' => '/albums/'.$photo->album_id.'?photo='.$photo->id,
            ])->all() : [];
        } else {
            $photoQuery = PostAttachment::query()
                ->where('type', PostAttachment::TYPE_IMAGE)
                ->whereHas('post', fn ($q) => $q->where('author_id', $user->id)->where('visibility', Post::VISIBILITY_PUBLIC));
            $photoCount = (clone $photoQuery)->count();
            $photoItems = $canSeeContent ? $photoQuery->latest('id')->limit(6)->get()->map(fn (PostAttachment $attachment) => [
                'id' => $attachment->id,
                'url' => $attachment->url,
                'href' => '/posts/'.$attachment->post_id,
            ])->all() : [];
        }

        return Inertia::render('profile/show', [
            'profile' => [
                ...$user->toCard(),
                'last_name' => $user->last_name,
                'cover_url' => $user->cover_url,
                'about' => $canSeeContent ? $user->about : null,
                'city' => $user->city,
                'birthday' => $canSeeContent ? $user->birthday?->toDateString() : null,
                'website' => $canSeeContent ? $user->website : null,
                'gender' => $user->gender,
                'is_private' => $user->is_private,
                'last_seen_at' => $user->last_seen_at?->toIso8601String(),
                'joined_at' => $user->created_at?->toIso8601String(),
                'role' => $user->role,
            ],
            'relation' => $relation,
            'canSeeContent' => $canSeeContent,
            'canMessage' => $viewer !== null && $messenger->canMessage($viewer, $user),
            'canPost' => $viewer !== null && in_array($relation, [FriendshipService::SELF, FriendshipService::FRIENDS], true),
            'stats' => [
                'friends' => count($friendIds),
                'posts' => $user->posts()->count(),
                'photos' => $photoCount,
                'mutual' => $viewer && $relation !== FriendshipService::SELF ? $this->friendships->mutualCount($viewer, $user) : 0,
            ],
            'friends' => $canSeeContent ? User::query()
                ->whereIn('id', $friendIds)
                ->orderByDesc('last_seen_at')
                ->limit(6)
                ->get()
                ->map->toCard()
                ->all() : [],
            'photos' => $photoItems,
            'photosHref' => $modules->enabled('photos') ? '/photos/u/'.$user->username : null,
            'audio' => $modules->enabled('music') && $canSeeContent ? [
                'href' => '/music/u/'.$user->username,
                'tracks' => $user->library()->count(),
            ] : null,
            'nowPlaying' => $modules->enabled('music') && $canSeeContent ? Inertia::defer(fn () => app(MusicService::class)->currentFor($user)) : null,
            'posts' => Inertia::scroll(fn () => $posts->setCollection(collect($items))),
        ]);
    }

    public function updateAvatar(Request $request): RedirectResponse
    {
        $request->validate(['avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240']]);
        $user = $request->user();

        $stored = $this->images->store($request->file('avatar'), 'avatars', cover: [512, 512]);
        $this->images->delete($user->avatar_path);
        $user->forceFill(['avatar_path' => $stored['path']])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фото профілю оновлено.']);

        return back();
    }

    public function updateCover(Request $request): RedirectResponse
    {
        $request->validate(['cover' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:15360']]);
        $user = $request->user();

        $stored = $this->images->store($request->file('cover'), 'covers', cover: [1920, 560]);
        $this->images->delete($user->cover_path);
        $user->forceFill(['cover_path' => $stored['path']])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Обкладинку оновлено.']);

        return back();
    }

    public function destroyAvatar(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->images->delete($user->avatar_path);
        $user->forceFill(['avatar_path' => null])->save();

        return back();
    }
}
