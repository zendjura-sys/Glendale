<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Like;
use App\Models\Movie;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\Track;
use App\Models\User;
use App\Notifications\PostInteraction;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\PostPresenter;
use App\Services\Spotify\SpotifyClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PostController extends Controller
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly ImageStorage $images,
        private readonly SiteSettings $settings,
        private readonly CommunityService $communities,
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
            'body' => ['nullable', 'string', 'max:'.(int) $this->settings->get('max_post_length'), 'required_without_all:images,music,movie_id'],
            'visibility' => ['required', Rule::in(Post::VISIBILITIES)],
            'wall' => ['nullable', 'string', 'exists:users,username'],
            'community' => ['nullable', 'string'],
            'as_community' => ['nullable', 'boolean'],
            'images' => ['nullable', 'array', 'max:'.$maxFiles],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.$maxKb],
            'music' => ['nullable', 'array'],
            'music.source' => ['required_with:music', Rule::in(['local', 'spotify'])],
            'music.id' => ['required_with:music'],
            'music.title' => ['required_if:music.source,spotify', 'nullable', 'string', 'max:200'],
            'music.artist' => ['required_if:music.source,spotify', 'nullable', 'string', 'max:300'],
            'music.album' => ['nullable', 'string', 'max:200'],
            'music.duration' => ['nullable', 'integer', 'min:0', 'max:7200'],
            'music.cover_url' => ['nullable', 'string', 'max:500'],
            'movie_id' => ['nullable', 'integer'],
        ], [
            'body.required_without_all' => 'Напишіть щось, додайте фото, музику або фільм.',
        ]);

        $movieId = null;
        if (isset($data['movie_id'])) {
            $movieId = Movie::query()->published()->whereKey($data['movie_id'])->value('id');
            if (! $movieId) {
                throw ValidationException::withMessages(['movie_id' => 'Фільм не знайдено.']);
            }
        }

        $music = isset($data['music']) ? $this->music($data['music']) : null;
        $asCommunity = false;

        if (isset($data['community'])) {
            $wallOwner = Community::query()->where('slug', $data['community'])->firstOrFail();
            $membership = $wallOwner->membershipFor($user);
            abort_unless($this->communities->canPost($wallOwner, $membership), 403, 'Публікувати в цій спільноті можуть лише її керівники.');
            $asCommunity = $wallOwner->isPublic() ? true : (bool) ($data['as_community'] ?? false) && $membership->isManager();
            $data['visibility'] = Post::VISIBILITY_PUBLIC;
        } else {
            $wallOwner = isset($data['wall']) ? User::query()->where('username', $data['wall'])->firstOrFail() : $user;
        }

        if ($wallOwner instanceof User && $wallOwner->isNot($user)) {
            abort_unless(
                $this->friendships->status($user, $wallOwner) === FriendshipService::FRIENDS,
                403,
                'Писати на стіні можуть лише друзі.',
            );
        }

        $post = DB::transaction(function () use ($request, $user, $wallOwner, $data, $asCommunity, $music, $movieId) {
            $post = Post::query()->create([
                'author_id' => $user->id,
                'wall_type' => $wallOwner->getMorphClass(),
                'wall_id' => $wallOwner->id,
                'as_community' => $asCommunity,
                'body' => isset($data['body']) ? trim($data['body']) : null,
                'music' => $music,
                'movie_id' => $movieId,
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

        if ($wallOwner instanceof User && $wallOwner->isNot($user)) {
            $wallOwner->notify(new PostInteraction(PostInteraction::WALL, $user, $post, Str::limit((string) $post->body, 80)));
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис опубліковано.']);

        return back();
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function music(array $input): array
    {
        if ($input['source'] === 'local') {
            $track = Track::query()->find((int) $input['id']);
            if (! $track) {
                throw ValidationException::withMessages(['music' => 'Трек не знайдено.']);
            }

            return ['source' => 'local', 'id' => $track->id];
        }

        if (! is_string($input['id']) || preg_match('/^[A-Za-z0-9]{22}$/', $input['id']) !== 1) {
            throw ValidationException::withMessages(['music' => 'Некоректний трек Spotify.']);
        }

        return SpotifyClient::sanitize($input);
    }

    public function destroy(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        $onOwnWall = $post->wall_type === $user->getMorphClass() && $post->wall_id === $user->id;

        abort_unless($post->author_id === $user->id || $onOwnWall || $this->managesWall($user, $post) || $user->isStaff(), 403);

        $post->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис видалено.']);

        return back();
    }

    public function pin(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        abort_unless(($post->wall_type === $user->getMorphClass() && $post->wall_id === $user->id) || $this->managesWall($user, $post), 403);

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

    private function managesWall(User $user, Post $post): bool
    {
        return $post->wall_type === 'community'
            && in_array($post->wall_id, $this->communities->managedIds($user));
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
