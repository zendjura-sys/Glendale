<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\CommentController;
use App\Http\Controllers\PostController;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedApiController extends ApiController
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly CommunityService $communities,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $friendIds = $this->friendships->friendIds($user);
        $communityIds = $this->communities->joinedIds($user);
        $hasSources = $friendIds !== [] || $communityIds !== [];
        $requested = $request->query('tab');
        $tab = match (true) {
            $requested === 'country' => 'country',
            $requested === 'discover' => 'discover',
            $requested === 'friends' && $hasSources => 'friends',
            $hasSources => 'friends',
            default => 'discover',
        };

        $query = Post::query()
            ->visibleTo($user, $friendIds)
            ->whereHas('author', fn (Builder $q) => $q->whereNull('banned_at'));

        if ($tab === 'friends') {
            $query->where(fn (Builder $q) => $q
                ->where(fn (Builder $w) => $w->where('wall_type', '!=', 'community')->whereIn('author_id', [...$friendIds, $user->id]))
                ->orWhere(fn (Builder $w) => $w->where('wall_type', 'community')->whereIn('wall_id', $communityIds ?: [0])));
        } elseif ($tab === 'country' && is_string($user->country) && $user->country !== '') {
            $query->where('visibility', Post::VISIBILITY_PUBLIC)
                ->whereHas('author', fn (Builder $q) => $q->where('country', $user->country));
        } elseif ($tab === 'country') {
            $query->whereRaw('1 = 0');
        } else {
            $query->where('visibility', Post::VISIBILITY_PUBLIC)
                ->where('created_at', '>=', now()->subDays(30))
                ->orderByDesc('likes_count');
        }

        $posts = $query->orderByDesc('id')->paginate(10);
        $items = $this->presenter->many(new Collection($posts->items()), $user);

        return response()->json([
            'tab' => $tab,
            'has_sources' => $hasSources,
            'posts' => $this->page($posts, $items),
            'suggestions' => collect($this->friendships->suggestions($user, 5))
                ->map(fn (array $s) => [...$s['user']->toCard(), 'mutual' => $s['mutual']])
                ->values(),
            'online_friends' => User::query()
                ->whereIn('id', $friendIds)
                ->where('last_seen_at', '>=', now()->subMinutes(5))
                ->limit(12)
                ->get()
                ->map->toCard()
                ->values(),
        ]);
    }

    public function store(Request $request, PostController $posts): JsonResponse
    {
        $post = $posts->publish($request);

        return response()->json(['post' => $this->presenter->one($post, $this->user($request))], 201);
    }

    public function show(Request $request, Post $post): JsonResponse
    {
        $user = $this->user($request);
        $this->visible($user, $post);

        return response()->json(['post' => $this->presenter->one($post, $user)]);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $user = $this->user($request);
        $onOwnWall = $post->wall_type === $user->getMorphClass() && $post->wall_id === $user->id;
        $manages = $post->wall_type === 'community' && in_array($post->wall_id, $this->communities->managedIds($user), true);

        abort_unless($post->author_id === $user->id || $onOwnWall || $manages || $user->isStaff(), 403);

        $post->delete();

        return response()->json(['ok' => true]);
    }

    public function like(Request $request, Post $post, PostController $posts): JsonResponse
    {
        return $posts->like($request, $post);
    }

    public function comments(Request $request, Post $post, CommentController $comments): JsonResponse
    {
        return $comments->index($request, $post);
    }

    public function comment(Request $request, Post $post, CommentController $comments): JsonResponse
    {
        return $comments->store($request, $post);
    }

    private function visible(User $user, Post $post): void
    {
        $visible = Post::query()
            ->whereKey($post->id)
            ->visibleTo($user, $this->friendships->friendIds($user))
            ->exists();

        abort_unless($visible, 404);
    }
}
