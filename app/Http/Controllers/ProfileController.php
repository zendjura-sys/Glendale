<?php

namespace App\Http\Controllers;

use App\Models\FriendMark;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\ProfileVisit;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserReport;
use App\Services\Achievements;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\Messenger;
use App\Services\Moderation\PeopleModeration;
use App\Services\MusicService;
use App\Services\PhotoService;
use App\Services\PlayedTogether;
use App\Services\PostCards;
use App\Services\PostPresenter;
use App\Services\Presence\SteamPresence;
use App\Support\Modules\ModuleManager;
use App\Support\ProfileBlocks;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
        if ($user->isFrozen() && ! $viewer?->is($user) && ! $viewer?->isStaff()) {
            return Inertia::render('profile/frozen', ['name' => $user->name]);
        }
        if ($viewer && ! $viewer->is($user) && $user->pref('show_visitors')) {
            ProfileVisit::query()->updateOrCreate(
                ['user_id' => $user->id, 'visitor_id' => $viewer->id],
                ['visited_at' => now()],
            );
        }
        $relation = $this->friendships->status($viewer, $user);
        $limited = $viewer && ! $viewer->isStaff() && UserBlock::between($user, $viewer);
        $canSeeContent = ! $limited && (! $user->is_private || in_array($relation, [FriendshipService::SELF, FriendshipService::FRIENDS], true) || $viewer?->isStaff());
        $friendship = $viewer && $relation === FriendshipService::FRIENDS ? $this->friendships->between($viewer, $user) : null;
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
                'alt' => $photo->alt,
                'is_sensitive' => $photo->is_sensitive,
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

        $mark = $viewer && $relation === FriendshipService::FRIENDS
            ? FriendMark::query()->where('user_id', $viewer->id)->where('friend_id', $user->id)->first()
            : null;
        $showVisitors = $viewer && $viewer->is($user) && (bool) $user->pref('show_visitors');
        $birthdayToday = $canSeeContent
            && $user->birthday !== null
            && $user->birthday->month === now()->month
            && $user->birthday->day === now()->day;

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
                'pin' => $this->pinCard($user),
                'looking_for_group' => (bool) $user->pref('looking_for_group'),
                'languages' => array_values(array_filter((array) $user->pref('languages', []), 'is_string')),
                'platforms' => $canSeeContent ? $this->platforms($user) : null,
                'alias' => $mark?->nickname,
                'note' => $mark?->note,
                'list' => $mark?->list,
            ],
            'steamLibrary' => $canSeeContent ? app(SteamPresence::class)->library($user) : [],
            'together' => $canSeeContent ? app(PlayedTogether::class)->cards($user) : [],
            'relation' => $relation,
            'canSeeContent' => $canSeeContent,
            'limited' => $limited,
            'blocked' => $viewer && UserBlock::between($viewer, $user),
            'friendsSince' => $friendship?->accepted_at?->toIso8601String(),
            'anniversary' => $friendship?->accepted_at !== null
                && $friendship->accepted_at->year < now()->year
                && $friendship->accepted_at->month === now()->month
                && $friendship->accepted_at->day === now()->day,
            'anniversaryYears' => $friendship?->accepted_at ? now()->year - $friendship->accepted_at->year : 0,
            'birthdayToday' => $birthdayToday,
            'showVisitors' => $showVisitors,
            'visitors' => $showVisitors
                ? ProfileVisit::query()
                    ->where('user_id', $user->id)
                    ->with('visitor')
                    ->orderByDesc('visited_at')
                    ->limit(12)
                    ->get()
                    ->map(function (ProfileVisit $visit): ?array {
                        if ($visit->visitor === null) {
                            return null;
                        }

                        return [
                            ...$visit->visitor->toCard(),
                            'visited_at' => $visit->visited_at->toIso8601String(),
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all()
                : [],
            'blockOrder' => ProfileBlocks::normalize($user->pref('profile_blocks')),
            'canMessage' => $viewer !== null && $messenger->canMessage($viewer, $user),
            'canPost' => $viewer !== null && in_array($relation, [FriendshipService::SELF, FriendshipService::FRIENDS], true),
            'stats' => [
                'friends' => count($friendIds),
                'posts' => $user->posts()->where('is_draft', false)->where(fn ($query) => $query->whereNull('publish_at')->orWhere('publish_at', '<=', now()))->count(),
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
            'achievements' => app(Achievements::class)->for($user),
            'photosHref' => $modules->enabled('photos') ? '/photos/u/'.$user->username : null,
            'audio' => $modules->enabled('music') && $canSeeContent ? [
                'href' => '/music/u/'.$user->username,
                'tracks' => $user->library()->count(),
            ] : null,
            'nowPlaying' => $modules->enabled('music') && $canSeeContent ? Inertia::defer(fn () => app(MusicService::class)->currentFor($user, $viewer)) : null,
            'posts' => Inertia::scroll(fn () => $posts->setCollection(collect($items))),
        ]);
    }

    public function card(User $user): Response
    {
        abort_if($user->isBanned() && ! request()->user()?->isStaff(), 404);

        $url = route('profile.show', $user);
        $svg = (new QRCode(new QROptions([
            'outputType' => QROutputInterface::MARKUP_SVG,
            'outputBase64' => false,
            'quietzoneSize' => 2,
            'scale' => 6,
        ])))->render($url);

        return Inertia::render('profile/card', [
            'profile' => $user->toCard(),
            'url' => $url,
            'qr' => preg_replace('/^<\?xml[^>]*>\s*/', '', $svg) ?: $svg,
        ]);
    }

    public function report(Request $request, User $user, PeopleModeration $moderation): RedirectResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(UserReport::REASONS))],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $moderation->report($request->user(), $user, $data['reason'], $data['comment'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Скаргу надіслано модераторам. Дякуємо!']);

        return back();
    }

    public function block(Request $request, User $user): RedirectResponse
    {
        $viewer = $request->user();
        abort_if($viewer->is($user), 422);

        $existing = UserBlock::query()->where('user_id', $viewer->id)->where('blocked_id', $user->id)->first();
        if ($existing) {
            $existing->delete();
        } else {
            UserBlock::query()->create(['user_id' => $viewer->id, 'blocked_id' => $user->id]);
        }

        return back();
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

    public function pin(Request $request, PostCards $cards): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:game,server,movie'],
            'id' => ['required', 'integer', 'min:1'],
        ]);
        $user = $request->user();
        $current = $user->pref('pin');
        $same = is_array($current) && ($current['kind'] ?? null) === $data['kind'] && (int) ($current['id'] ?? 0) === (int) $data['id'];
        if ($same) {
            $user->mergePref(['pin' => null]);

            return response()->json(['pinned' => false, 'pin' => null]);
        }
        $card = $cards->resolve($data['kind'], (int) $data['id']);
        abort_unless($card !== null, 404);
        $user->mergePref(['pin' => ['kind' => $data['kind'], 'id' => (int) $data['id']]]);

        return response()->json(['pinned' => true, 'pin' => $card]);
    }

    /**
     * @return array{steam: string|null, xbox: string|null, xbox_name: string|null, playstation: string|null, playstation_name: string|null}
     */
    private function platforms(User $user): array
    {
        $xbox = is_string($user->pref('xbox')) ? $user->pref('xbox') : null;
        $playstation = is_string($user->pref('playstation')) ? $user->pref('playstation') : null;

        return [
            'steam' => $user->steam_id ? 'https://steamcommunity.com/profiles/'.$user->steam_id : null,
            'xbox' => $xbox ? 'https://www.xbox.com/play/user/'.rawurlencode($xbox) : null,
            'xbox_name' => $xbox,
            'playstation' => $playstation ? 'https://psnprofiles.com/'.rawurlencode($playstation) : null,
            'playstation_name' => $playstation,
        ];
    }

    /**
     * @return array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}|null
     */
    private function pinCard(User $user): ?array
    {
        $pin = $user->pref('pin');
        if (! is_array($pin) || ! isset($pin['kind'], $pin['id'])) {
            return null;
        }

        return app(PostCards::class)->resolve((string) $pin['kind'], (int) $pin['id']);
    }

    public function destroyAvatar(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->images->delete($user->avatar_path);
        $user->forceFill(['avatar_path' => null])->save();

        return back();
    }
}
