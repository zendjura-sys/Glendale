<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Movie;
use App\Models\Photo;
use App\Models\Post;
use App\Notifications\PostInteraction;
use App\Services\CommunityWall;
use App\Services\FriendshipService;
use App\Services\Mentions;
use App\Services\Moderation\ContentFilter;
use App\Services\PhotoService;
use App\Services\PostPresenter;
use App\Support\CommentOrder;
use App\Support\Stickers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CommentController extends Controller
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly PhotoService $photos,
    ) {}

    public function index(Request $request, Post $post): JsonResponse
    {
        $viewer = $request->user();
        $this->authorizeView($request, $post);

        $comments = $post->comments()->with('user');
        CommentOrder::apply($comments, $request->query('sort'));
        $comments = $comments->limit(200)->get();
        $liked = Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $comments->modelKeys())
            ->pluck('likeable_id')
            ->flip();

        $canPin = $viewer->id === $post->author_id || $viewer->isStaff();

        return response()->json([
            'comments' => $comments->map(fn (Comment $c) => $this->presenter->comment($c, $viewer, $liked->has($c->id), $canPin))->values(),
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        $this->authorizeView($request, $post);
        abort_unless($post->comments_enabled, 403, 'Коментарі вимкнено.');

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:2000', 'required_without:sticker'],
            'parent_id' => ['nullable', 'integer'],
            'spoiler' => ['sometimes', 'boolean'],
            'sticker' => ['nullable', 'string', Rule::in(array_keys(Stickers::ITEMS))],
        ]);

        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($user);
        $data['body'] = trim((string) ($data['body'] ?? ''));
        app(CommunityWall::class)->guardComment($post, $user, $data['body']);
        if ($data['body'] !== '') {
            $data['body'] = (string) $filter->clean($data['body']);
        }

        $parentId = isset($data['parent_id'])
            ? $post->comments()->whereKey($data['parent_id'])->value('id')
            : null;

        $comment = DB::transaction(function () use ($post, $user, $data, $parentId) {
            $comment = $post->comments()->create([
                'user_id' => $user->id,
                'parent_id' => $parentId,
                'body' => $data['body'],
                'spoiler' => (bool) ($data['spoiler'] ?? false),
                'sticker' => $data['sticker'] ?? null,
            ]);
            $post->increment('comments_count');

            return $comment;
        });

        if ($post->author_id !== $user->id) {
            $excerpt = $comment->spoiler ? 'Спойлер' : ($comment->body !== '' ? Str::limit($comment->body, 80) : Stickers::emoji($comment->sticker));
            $post->author->notify(new PostInteraction(PostInteraction::COMMENT, $user, $post, $excerpt));
        }

        app(Mentions::class)->notify($user, $comment->body, route('posts.show', $post, absolute: false));

        return response()->json([
            'comment' => $this->presenter->comment($comment->load('user'), $user, false, $user->id === $post->author_id || $user->isStaff()),
            'comments_count' => $post->fresh()->comments_count,
        ], 201);
    }

    public function pin(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        $comment->loadMissing('post', 'movie');
        abort_unless($comment->parent_id === null, 422, 'Закріпити можна лише коментар, не відповідь.');

        if ($comment->post_id !== null) {
            $post = $comment->post;
            abort_unless($post instanceof Post, 404);
            $this->authorizeView($request, $post);
            abort_unless($post->author_id === $user->id || $user->isStaff(), 403);
            if (! $comment->is_pinned) {
                Comment::query()->where('post_id', $post->id)->where('is_pinned', true)->update(['is_pinned' => false]);
            }
        } elseif ($comment->movie_id !== null) {
            abort_unless($comment->movie instanceof Movie, 404);
            abort_unless($user->isStaff(), 403);
            if (! $comment->is_pinned) {
                Comment::query()->where('movie_id', $comment->movie_id)->where('is_pinned', true)->update(['is_pinned' => false]);
            }
        } else {
            abort(404);
        }

        $comment->update(['is_pinned' => ! $comment->is_pinned]);

        return response()->json(['id' => $comment->id, 'is_pinned' => $comment->is_pinned]);
    }

    public function destroy(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        $subject = $comment->post ?? $comment->photo ?? $comment->movie;
        $ownsSubject = match (true) {
            $subject instanceof Post => $subject->wall_type === $user->getMorphClass() && $subject->wall_id === $user->id,
            $subject instanceof Photo => $subject->user_id === $user->id || $this->photos->canManage($subject->album, $user),
            default => false,
        };

        abort_unless($comment->user_id === $user->id || $ownsSubject || $user->isStaff(), 403);

        DB::transaction(function () use ($comment, $subject) {
            $comment->delete();
            $subject?->decrement('comments_count');
        });

        return response()->json(['comments_count' => $subject?->fresh()->comments_count ?? 0]);
    }

    public function like(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        if ($comment->photo_id !== null) {
            abort_unless($comment->photo && $this->photos->canView($comment->photo->album, $user), 404);
        } elseif ($comment->movie_id !== null) {
            abort_unless($comment->movie instanceof Movie && ($comment->movie->is_published || $user->isStaff()), 404);
        } else {
            $this->authorizeView($request, $comment->post);
        }

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
