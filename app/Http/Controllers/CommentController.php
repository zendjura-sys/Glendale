<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Post;
use App\Notifications\PostInteraction;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CommentController extends Controller
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
    ) {}

    public function index(Request $request, Post $post): JsonResponse
    {
        $viewer = $request->user();
        $this->authorizeView($request, $post);

        $comments = $post->comments()->with('user')->orderBy('id')->limit(200)->get();
        $liked = Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $comments->modelKeys())
            ->pluck('likeable_id')
            ->flip();

        return response()->json([
            'comments' => $comments->map(fn (Comment $c) => $this->presenter->comment($c, $viewer, $liked->has($c->id)))->values(),
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        $this->authorizeView($request, $post);
        abort_unless($post->comments_enabled, 403, 'Коментарі вимкнено.');

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'parent_id' => ['nullable', 'integer'],
        ]);

        $parentId = isset($data['parent_id'])
            ? $post->comments()->whereKey($data['parent_id'])->value('id')
            : null;

        $comment = DB::transaction(function () use ($post, $user, $data, $parentId) {
            $comment = $post->comments()->create([
                'user_id' => $user->id,
                'parent_id' => $parentId,
                'body' => trim($data['body']),
            ]);
            $post->increment('comments_count');

            return $comment;
        });

        if ($post->author_id !== $user->id) {
            $post->author->notify(new PostInteraction(PostInteraction::COMMENT, $user, $post, Str::limit($comment->body, 80)));
        }

        return response()->json([
            'comment' => $this->presenter->comment($comment->load('user'), $user),
            'comments_count' => $post->fresh()->comments_count,
        ], 201);
    }

    public function destroy(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        $post = $comment->post;
        $onOwnWall = $post && $post->wall_type === $user->getMorphClass() && $post->wall_id === $user->id;

        abort_unless($comment->user_id === $user->id || $onOwnWall || $user->isStaff(), 403);

        DB::transaction(function () use ($comment, $post) {
            $comment->delete();
            $post?->decrement('comments_count');
        });

        return response()->json(['comments_count' => $post?->fresh()->comments_count ?? 0]);
    }

    public function like(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        $this->authorizeView($request, $comment->post);

        $liked = DB::transaction(function () use ($user, $comment) {
            $deleted = Like::query()
                ->where('user_id', $user->id)
                ->where('likeable_type', $comment->getMorphClass())
                ->where('likeable_id', $comment->id)
                ->delete();

            if ($deleted) {
                $comment->decrement('likes_count');

                return false;
            }

            Like::query()->create([
                'user_id' => $user->id,
                'likeable_type' => $comment->getMorphClass(),
                'likeable_id' => $comment->id,
            ]);
            $comment->increment('likes_count');

            return true;
        });

        return response()->json(['liked' => $liked, 'likes_count' => $comment->fresh()->likes_count]);
    }

    private function authorizeView(Request $request, Post $post): void
    {
        $viewer = $request->user();
        $visible = Post::query()
            ->whereKey($post->id)
            ->visibleTo($viewer, $this->friendships->friendIds($viewer))
            ->exists();

        abort_unless($visible, 404);
    }
}
