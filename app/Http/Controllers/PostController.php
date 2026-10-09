<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Like;
use App\Models\Movie;
use App\Models\Poll;
use App\Models\PollOption;
use App\Models\PollVote;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\PostHide;
use App\Models\Track;
use App\Models\User;
use App\Models\UserMute;
use App\Notifications\PostInteraction;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\Media\LinkPreview;
use App\Services\Media\YoutubePreview;
use App\Services\Moderation\ContentFilter;
use App\Services\PostCards;
use App\Services\PostPresenter;
use App\Services\ReactionDigest;
use App\Services\ScheduledPosts;
use App\Services\Spotify\SpotifyClient;
use App\Support\Settings\SiteSettings;
use App\Support\Stickers;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
        private readonly ScheduledPosts $scheduled,
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
        $post = $this->publish($request);
        if ($post->is_draft || $post->publish_at?->isFuture()) {
            Inertia::flash('toast', ['type' => 'success', 'message' => $post->is_draft ? 'Чернетку збережено.' : 'Запис заплановано.']);

            return to_route('posts.drafts');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис опубліковано.']);

        return back();
    }

    public function drafts(Request $request): Response
    {
        $posts = Post::query()
            ->where('author_id', $request->user()->id)
            ->where(fn (Builder $query) => $query->where('is_draft', true)->orWhere('publish_at', '>', now()))
            ->latest('id')
            ->limit(30)
            ->get();

        return Inertia::render('posts/drafts', [
            'drafts' => $posts->map(fn (Post $post) => [
                'id' => $post->id,
                'body' => $post->body,
                'created_at' => $post->created_at->toIso8601String(),
                'publish_at' => $post->publish_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    public function release(Request $request, Post $post): RedirectResponse
    {
        $waiting = $post->publish_at?->isFuture() === true;
        abort_unless($post->author_id === $request->user()->id && ($post->is_draft || $waiting), 403);
        $post->forceFill(['is_draft' => false, 'publish_at' => null, 'created_at' => now()])->save();
        $this->scheduled->announce($post);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис опубліковано.']);

        return to_route('posts.show', $post);
    }

    public function publish(Request $request): Post
    {
        $user = $request->user();
        app(ContentFilter::class)->ensureCanPost($user);
        $maxFiles = (int) $this->settings->get('max_attachments');
        $maxKb = (int) $this->settings->get('max_upload_mb') * 1024;

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:'.(int) $this->settings->get('max_post_length'), 'required_without_all:images,music,movie_id,poll,card,sticker'],
            'sticker' => ['nullable', 'string', Rule::in(array_keys(Stickers::ITEMS))],
            'card' => ['nullable', 'array'],
            'card.kind' => ['required_with:card', Rule::in(['game', 'server', 'game_event', 'server_event'])],
            'card.id' => ['required_with:card', 'integer', 'min:1'],
            'poll' => ['nullable', 'array'],
            'poll.question' => ['required_with:poll', 'string', 'max:200'],
            'poll.options' => ['required_with:poll', 'array', 'min:2', 'max:4'],
            'poll.options.*' => ['required', 'string', 'max:80'],
            'visibility' => ['required', Rule::in(Post::VISIBILITIES)],
            'spoiler' => ['sometimes', 'boolean'],
            'draft' => ['sometimes', 'boolean'],
            'publish_at' => ['nullable', 'date'],
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

        $card = null;
        if (isset($data['card'])) {
            $card = app(PostCards::class)->resolve($data['card']['kind'], (int) $data['card']['id']);
            if ($card === null) {
                throw ValidationException::withMessages(['card' => 'Картку не знайдено.']);
            }
        }

        $publishAt = $this->schedule($request, $data);

        $post = DB::transaction(function () use ($request, $user, $wallOwner, $data, $asCommunity, $music, $movieId, $card, $publishAt) {
            $post = Post::query()->create([
                'author_id' => $user->id,
                'wall_type' => $wallOwner->getMorphClass(),
                'wall_id' => $wallOwner->id,
                'as_community' => $asCommunity,
                'body' => isset($data['body']) && trim($data['body']) !== '' ? app(ContentFilter::class)->clean(trim($data['body'])) : null,
                'sticker' => $data['sticker'] ?? null,
                'music' => $music,
                'movie_id' => $movieId,
                'link' => $this->linkCard($data['body'] ?? null),
                'card' => $card,
                'visibility' => $data['visibility'],
                'spoiler' => (bool) ($data['spoiler'] ?? false),
                'is_draft' => $request->boolean('draft'),
                'publish_at' => $publishAt,
            ]);

            if (isset($data['poll'])) {
                $poll = Poll::query()->create([
                    'post_id' => $post->id,
                    'question' => trim($data['poll']['question']),
                ]);
                foreach (array_values($data['poll']['options']) as $position => $label) {
                    $poll->options()->create([
                        'label' => trim((string) $label),
                        'position' => $position,
                    ]);
                }
            }

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

        if (! $post->is_draft && $publishAt === null) {
            $this->scheduled->announce($post);
        }

        return $post;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function schedule(Request $request, array $data): ?Carbon
    {
        if ($request->boolean('draft') || empty($data['publish_at'])) {
            return null;
        }
        $at = Carbon::parse((string) $data['publish_at'], 'Europe/Kyiv');
        if ($at->lte(now()) || $at->gt(now()->addDays(30))) {
            throw ValidationException::withMessages(['publish_at' => 'Оберіть час у найближчі 30 днів.']);
        }

        return $at;
    }

    public function update(Request $request, Post $post): RedirectResponse
    {
        abort_unless($this->editable($request->user(), $post), 403, 'Час на редагування минув.');
        $data = $request->validate([
            'body' => ['required', 'string', 'max:'.(int) $this->settings->get('max_post_length')],
        ]);
        app(ContentFilter::class)->ensureCanPost($request->user());
        $body = (string) app(ContentFilter::class)->clean(trim($data['body']));
        $post->update([
            'body' => $body,
            'link' => $this->linkCard($body),
            'edited_at' => now(),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис змінено.']);

        return back();
    }

    private function editable(?User $user, Post $post): bool
    {
        if (! $user || $post->author_id !== $user->id) {
            return false;
        }
        if ($post->is_draft || $post->publish_at?->isFuture()) {
            return true;
        }

        return $post->created_at->greaterThan(now()->subMinutes(Post::EDIT_MINUTES));
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

    public function hide(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);
        abort_if($post->author_id === $user->id, 422);

        PostHide::query()->firstOrCreate(
            ['user_id' => $user->id, 'post_id' => $post->id],
            ['author_id' => $post->author_id],
        );

        return back();
    }

    public function mute(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);
        abort_if($post->author_id === $user->id, 422);

        $existing = UserMute::query()
            ->where('user_id', $user->id)
            ->where('muted_id', $post->author_id)
            ->first();

        if ($existing) {
            $existing->delete();
        } else {
            UserMute::query()->create([
                'user_id' => $user->id,
                'muted_id' => $post->author_id,
            ]);
        }

        return back();
    }

    public function share(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);
        abort_if($post->is_draft || $post->publish_at?->isFuture(), 422);

        $source = $post->shared_post_id
            ? Post::query()->find($post->shared_post_id) ?? $post
            : $post;
        abort_if($source->author_id === $user->id, 422);
        $source->loadMissing('author');

        $copy = Post::query()->create([
            'author_id' => $user->id,
            'wall_type' => $user->getMorphClass(),
            'wall_id' => $user->id,
            'body' => $source->body,
            'visibility' => Post::VISIBILITY_PUBLIC,
            'spoiler' => $source->spoiler,
            'link' => $source->link,
            'shared_post_id' => $source->id,
        ]);

        if ($source->author && $source->author->isNot($user)) {
            $excerpt = $source->spoiler ? 'Спойлер' : Str::limit((string) $source->body, 80);
            $source->author->notify(new PostInteraction(PostInteraction::SHARE, $user, $copy, $excerpt));
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис на вашій стіні.']);

        return back();
    }

    public function quote(Request $request, Post $post): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);
        abort_if($post->is_draft || $post->publish_at?->isFuture(), 422);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:'.(int) $this->settings->get('max_post_length')],
        ]);
        app(ContentFilter::class)->ensureCanPost($user);
        $body = (string) app(ContentFilter::class)->clean(trim($data['body']));
        abort_if($body === '', 422);

        $copy = Post::query()->create([
            'author_id' => $user->id,
            'wall_type' => $user->getMorphClass(),
            'wall_id' => $user->id,
            'body' => $body,
            'visibility' => Post::VISIBILITY_PUBLIC,
            'quoted_post_id' => $post->id,
        ]);

        $post->loadMissing('author');
        if ($post->author && $post->author->isNot($user)) {
            $post->author->notify(new PostInteraction(PostInteraction::QUOTE, $user, $copy, Str::limit($body, 80)));
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Цитату опубліковано.']);

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

    public function vote(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);
        $poll = $post->poll()->with('options')->firstOrFail();
        $data = $request->validate(['option_id' => ['required', 'integer']]);
        $option = $poll->options->firstWhere('id', (int) $data['option_id']);
        abort_unless($option instanceof PollOption, 422);

        DB::transaction(function () use ($user, $poll, $option) {
            $existing = PollVote::query()->where('poll_id', $poll->id)->where('user_id', $user->id)->lockForUpdate()->first();
            if ($existing?->option_id === $option->id) {
                return;
            }
            if ($existing) {
                PollOption::query()->whereKey($existing->option_id)->where('votes_count', '>', 0)->decrement('votes_count');
                $existing->update(['option_id' => $option->id]);
            } else {
                PollVote::query()->create([
                    'poll_id' => $poll->id,
                    'option_id' => $option->id,
                    'user_id' => $user->id,
                ]);
            }
            $option->increment('votes_count');
        });

        return response()->json($this->presenter->one($post->fresh(), $user)['poll']);
    }

    public function like(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        $this->authorizeView($user, $post);

        $reaction = $request->validate([
            'reaction' => ['nullable', Rule::in(['like', 'fire', 'laugh', 'gg', 'sad'])],
        ])['reaction'] ?? 'like';

        $created = false;
        $current = DB::transaction(function () use ($user, $post, $reaction, &$created) {
            $existing = Like::query()
                ->where('user_id', $user->id)
                ->where('likeable_type', $post->getMorphClass())
                ->where('likeable_id', $post->id)
                ->lockForUpdate()
                ->first();

            if ($existing && $existing->reaction === $reaction) {
                $existing->delete();
                $post->decrement('likes_count');

                return null;
            }
            if ($existing) {
                $existing->update(['reaction' => $reaction]);

                return $reaction;
            }

            Like::query()->create([
                'user_id' => $user->id,
                'likeable_type' => $post->getMorphClass(),
                'likeable_id' => $post->id,
                'reaction' => $reaction,
            ]);
            $post->increment('likes_count');
            $created = true;

            return $reaction;
        });

        if ($created && $post->author_id !== $user->id) {
            $post->loadMissing('author');
            app(ReactionDigest::class)->record($post->author, new PostInteraction(PostInteraction::LIKE, $user, $post));
        }

        return response()->json([
            'liked' => $current !== null,
            'reaction' => $current,
            'likes_count' => $post->fresh()->likes_count,
        ]);
    }

    /**
     * @return array{url: string, title: string, thumbnail: string|null, author: string|null, site: string}|null
     */
    private function linkCard(?string $text): ?array
    {
        return app(YoutubePreview::class)->fromText($text) ?? app(LinkPreview::class)->fromText($text);
    }

    private function managesWall(User $user, Post $post): bool
    {
        return $post->wall_type === 'community'
            && in_array($post->wall_id, $this->communities->managedIds($user));
    }

    private function authorizeView(?User $viewer, Post $post): void
    {
        if ($post->is_draft || $post->publish_at?->isFuture()) {
            abort_unless($viewer && ($viewer->id === $post->author_id || $viewer->isStaff()), 404);

            return;
        }

        $visible = Post::query()
            ->whereKey($post->id)
            ->visibleTo($viewer, $viewer ? $this->friendships->friendIds($viewer) : [])
            ->exists();

        abort_unless($visible, 404);
    }
}
