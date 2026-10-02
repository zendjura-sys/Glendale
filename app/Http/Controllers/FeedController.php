<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FeedController extends Controller
{
    public const PER_PAGE = 10;

    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly CommunityService $communities,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $friendIds = $this->friendships->friendIds($user);
        $communityIds = $this->communities->joinedIds($user);
        $hasSources = $friendIds !== [] || $communityIds !== [];
        $tab = $request->query('tab') === 'discover' || ! $hasSources ? 'discover' : 'friends';

        $query = Post::query()
            ->visibleTo($user, $friendIds)
            ->whereHas('author', fn (Builder $q) => $q->whereNull('banned_at'));

        if ($tab === 'friends') {
            $query->where(fn (Builder $q) => $q
                ->where(fn (Builder $w) => $w->where('wall_type', '!=', 'community')->whereIn('author_id', [...$friendIds, $user->id]))
                ->orWhere(fn (Builder $w) => $w->where('wall_type', 'community')->whereIn('wall_id', $communityIds ?: [0])));
        } else {
            $query->where('visibility', Post::VISIBILITY_PUBLIC)
                ->where('created_at', '>=', now()->subDays(30))
                ->orderByDesc('likes_count');
        }

        $posts = $query->orderByDesc('id')->cursorPaginate(self::PER_PAGE)->withQueryString();
        $items = $this->presenter->many(new Collection($posts->items()), $user);

        return Inertia::render('feed/index', [
            'tab' => $tab,
            'hasFriends' => $hasSources,
            'posts' => Inertia::scroll(fn () => $posts->setCollection(collect($items))),
            'suggestions' => Inertia::defer(fn () => collect($this->friendships->suggestions($user, 5))
                ->map(fn (array $s) => [...$s['user']->toCard(), 'mutual' => $s['mutual']])
                ->all()),
            'onlineFriends' => Inertia::defer(fn () => User::query()
                ->whereIn('id', $friendIds)
                ->where('last_seen_at', '>=', now()->subMinutes(5))
                ->limit(12)
                ->get()
                ->map->toCard()
                ->all()),
            'birthdays' => Inertia::defer(fn () => User::query()
                ->whereIn('id', $friendIds)
                ->whereNotNull('birthday')
                ->whereMonth('birthday', now()->month)
                ->whereDay('birthday', '>=', now()->day)
                ->orderByRaw('DAY(birthday)')
                ->limit(4)
                ->get()
                ->map(fn (User $u) => [...$u->toCard(), 'birthday' => $u->birthday?->toDateString()])
                ->all()),
        ]);
    }
}
