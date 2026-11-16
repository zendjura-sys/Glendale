<?php

namespace App\Http\Controllers;

use App\Models\Like;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\User;
use App\Notifications\PostInteraction;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\PostPresenter;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PostController extends Controller
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly ImageStorage $images,
        private readonly SiteSettings $settings,
    ) {}

    public function show(Request $request, Post $post): Response
    {
        $viewer = $request->user();
        $this->authorizeView($viewer, $post);

        return Inertia::render('posts/show', [
            'post' => $this->presenter->one($post, $viewer),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $maxFiles = (int) $this->settings->get('max_attachments');
        $maxKb = (int) $this->settings->get('max_upload_mb') * 1024;

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:'.(int) $this->settings->get('max_post_length'), 'required_without:images'],
            'visibility' => ['required', Rule::in(Post::VISIBILITIES)],
            'wall' => ['nullable', 'string', 'exists:users,username'],
            'images' => ['nullable', 'array', 'max:'.$maxFiles],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.$maxKb],
        ], [
            'body.required_without' => 'Напишіть щось або додайте фото.',
        ]);

        $wallOwner = isset($data['wall']) ? User::query()->where('username', $data['wall'])->firstOrFail() : $user;

        if ($wallOwner->isNot($user)) {
            abort_unless(
                $this->friendships->status($user, $wallOwner) === FriendshipService::FRIENDS,
                403,
                'Писати на стіні можуть лише друзі.',
            );
        }

        $post = DB::transaction(function () use ($request, $user, $wallOwner, $data) {
            $post = Post::query()->create([
                'author_id' => $user->id,
                'wall_type' => $wallOwner->getMorphClass(),
                'wall_id' => $wallOwner->id,
                'body' => isset($data['body']) ? trim($data['body']) : null,
                'visibility' => $data['visibility'],
            ]);

            foreach (array_values($request->file('images', [])) as $position => $file) {
                $stored = $this->images->store($file, 'posts');
                $post->attachments()->create([
                    'type' => PostAttachment::TYPE_IMAGE,
                    'path' => $stored['path'],
                    'mime' => $stored['mime'],
                    'width' => $stored['width'],
                    'height' => $stored['height'],
                    'size' => $stored['size'],
                    'position' => $position,
                ]);
            }

            return $post;
        });

        if ($wallOwner->isNot($user)) {
            $wallOwner->notify(new PostInteraction(PostInteraction::WALL, $user, $post, Str::limit((string) $post->body, 80)));
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис опубліковано.']);

        return back();
    }

    public function destroy(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        $onOwnWall = $post->wall_type === $user->getMorphClass() && $post->wall_id === $user->id;

        abort_unless($post->author_id === $user->id || $onOwnWall || $user->isStaff(), 403);

        $post->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис видалено.']);

        return back();
    }

    public function pin(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        abort_unless($post->wall_type === $user->getMorphClass() && $post->wall_id === $user->id, 403);

        DB::transaction(function () use ($post) {
            $pin = ! $post->is_pinned;
            Post::query()
                ->where('wall_type', $post->wall_type)
                ->where('wall_id', $post->wall_id)
                ->where('is_pinned', true)
                ->update(['is_pinned' => false]);
            $post->update(['is_pinned' => $pin]);
        });

        return back();
    }

    public function like(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);

        $liked = DB::transaction(function () use ($user, $post) {
            $deleted = Like::query()
                ->where('user_id', $user->id)
                ->where('likeable_type', $post->getMorphClass())
                ->where('likeable_id', $post->id)
                ->delete();

            if ($deleted) {
                $post->decrement('likes_count');

                return false;
            }

            Like::query()->create([
                'user_id' => $user->id,
                'likeable_type' => $post->getMorphClass(),
                'likeable_id' => $post->id,
            ]);
            $post->increment('likes_count');

            return true;
        });

        if ($liked && $post->author_id !== $user->id) {
            $post->author->notify(new PostInteraction(PostInteraction::LIKE, $user, $post));
        }

        return response()->json(['liked' => $liked, 'likes_count' => $post->fresh()->likes_count]);
    }

    private function authorizeView(?User $viewer, Post $post): void
    {
        $visible = Post::query()
            ->whereKey($post->id)
            ->visibleTo($viewer, $viewer ? $this->friendships->friendIds($viewer) : [])
            ->exists();

        abort_unless($visible, 404);
    }
}
