<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\Community;
use App\Models\Like;
use App\Models\Movie;
use App\Models\PollOption;
use App\Models\PollVote;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\Save;
use App\Models\Track;
use App\Models\User;
use App\Models\UserMute;
use Illuminate\Database\Eloquent\Collection;

class PostPresenter
{
    public const PREVIEW_COMMENTS = 2;

    /** @var array<int, array<string, mixed>> */
    private array $tracks = [];

    /** @var array<int, array<string, mixed>> */
    private array $movies = [];

    /** @var array<int, true> */
    private array $saved = [];

    /** @var array<int, int> */
    private array $votes = [];

    /** @var array<int, true> */
    private array $muted = [];

    /**
     * Готує записи до показу: автор, стіна, вкладення, останні коментарі, лайки глядача.
     *
     * @param  Collection<int, Post>  $posts
     * @return list<array<string, mixed>>
     */
    public function many(Collection $posts, ?User $viewer): array
    {
        if ($posts->isEmpty()) {
            return [];
        }

        $posts->loadMissing(['author', 'wall', 'attachments', 'sharedPost.author']);
        $ids = $posts->modelKeys();

        $previewComments = Comment::query()
            ->with('user')
            ->whereIn('post_id', $ids)
            ->whereIn('id', function ($query) use ($ids) {
                $query->selectRaw('id')->from('comments as c')
                    ->whereIn('c.post_id', $ids)
                    ->whereNull('c.deleted_at')
                    ->whereRaw('(select count(*) from comments c2 where c2.post_id = c.post_id and c2.deleted_at is null and c2.id >= c.id) <= ?', [self::PREVIEW_COMMENTS]);
            })
            ->orderBy('id')
            ->get()
            ->groupBy('post_id');

        $pinned = Comment::query()->with('user')->whereIn('post_id', $ids)->where('is_pinned', true)->get();
        foreach ($pinned as $comment) {
            $group = $previewComments->get($comment->post_id, collect());
            if ($group->doesntContain(fn (Comment $item) => $item->id === $comment->id)) {
                $previewComments->put($comment->post_id, $group->prepend($comment));
            }
        }

        $reactions = $viewer ? Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Post)->getMorphClass())
            ->whereIn('likeable_id', $ids)
            ->pluck('reaction', 'likeable_id')
            ->all() : [];

        $localTrackIds = $posts->map(fn (Post $p) => ($p->music['source'] ?? null) === 'local' ? (int) $p->music['id'] : null)->filter()->unique();
        $tracks = $localTrackIds->isNotEmpty() ? Track::query()->whereIn('id', $localTrackIds)->get()->keyBy('id') : collect();
        $ownedTracks = $viewer && $tracks->isNotEmpty() ? app(MusicService::class)->libraryIds($viewer, $tracks->keys()) : [];
        $this->tracks = $tracks->map(fn (Track $t) => $t->toCard(isset($ownedTracks[$t->id])))->all();

        $movieIds = $posts->pluck('movie_id')->filter()->unique();
        $this->movies = $movieIds->isNotEmpty()
            ? Movie::query()->whereIn('id', $movieIds)->get()->mapWithKeys(fn (Movie $m) => [$m->id => [
                ...$m->toCard(),
                'description' => $m->description,
                'available' => $m->is_published,
            ]])->all()
            : [];

        $posts->loadMissing('poll.options');
        $this->saved = $viewer
            ? Save::query()->where('user_id', $viewer->id)->where('kind', Save::POST)->whereIn('subject_id', $ids)->pluck('subject_id')->flip()->all()
            : [];
        $pollIds = $posts->map(fn (Post $post) => $post->poll?->id)->filter()->values();
        $this->votes = $viewer && $pollIds->isNotEmpty()
            ? PollVote::query()->where('user_id', $viewer->id)->whereIn('poll_id', $pollIds)->pluck('option_id', 'poll_id')->map(fn ($id) => (int) $id)->all()
            : [];
        $this->muted = $viewer
            ? UserMute::query()->where('user_id', $viewer->id)->pluck('muted_id')->flip()->map(fn () => true)->all()
            : [];

        $managed = $viewer && $posts->contains('wall_type', 'community')
            ? array_flip(app(CommunityService::class)->managedIds($viewer))
            : [];

        $commentIds = $previewComments->flatten()->pluck('id')->all();
        $likedCommentIds = $viewer && $commentIds ? Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $commentIds)
            ->pluck('likeable_id')
            ->flip()
            ->all() : [];

        return array_values($posts->map(fn (Post $post) => $this->present(
            $post,
            $viewer,
            isset($reactions[$post->id]) ? (string) $reactions[$post->id] : null,
            $post->wall instanceof Community && isset($managed[$post->wall_id]),
            array_values(($previewComments[$post->id] ?? collect())->map(fn (Comment $c) => $this->comment(
                $c,
                $viewer,
                isset($likedCommentIds[$c->id]),
                $viewer !== null && ($viewer->id === $post->author_id || $viewer->isStaff()),
            ))->all()),
        ))->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function one(Post $post, ?User $viewer): array
    {
        return $this->many(new Collection([$post]), $viewer)[0];
    }

    /**
     * @param  list<array<string, mixed>>  $comments
     * @return array<string, mixed>
     */
    private function present(Post $post, ?User $viewer, ?string $reaction, bool $managesWall, array $comments): array
    {
        $wall = $post->wall;
        $community = $wall instanceof Community ? $wall : null;
        $ownWall = $viewer !== null && $wall instanceof User && $wall->id === $viewer->id;
        $publisher = $community && $post->as_community ? $community : null;
        $sourceAuthorId = $post->sharedPost?->author_id ?? $post->author_id;
        $shareable = $viewer !== null && $sourceAuthorId !== $viewer->id && ! $post->is_draft && ! $post->publish_at?->isFuture();

        $wallCard = match (true) {
            $publisher !== null => null,
            $community !== null => ['name' => $community->name, 'href' => '/c/'.$community->slug],
            $wall instanceof User && $wall->id !== $post->author_id => ['name' => $wall->name, 'href' => '/'.$wall->username],
            default => null,
        };

        return [
            'id' => $post->id,
            'body' => $post->body,
            'spoiler' => $post->spoiler,
            'visibility' => $post->visibility,
            'is_pinned' => $post->is_pinned,
            'comments_enabled' => $post->comments_enabled,
            'likes_count' => $post->likes_count,
            'comments_count' => $post->comments_count,
            'views_count' => $post->views_count,
            'created_at' => $post->created_at->toIso8601String(),
            'edited_at' => $post->edited_at?->toIso8601String(),
            'author' => $post->author->toCard(),
            'publisher' => $publisher ? [...$publisher->toCard(), 'href' => '/c/'.$publisher->slug] : null,
            'wall' => $wallCard,
            'attachments' => $post->attachments->map(fn (PostAttachment $a) => [
                'id' => $a->id,
                'type' => $a->type,
                'url' => $a->url,
                'width' => $a->width,
                'height' => $a->height,
            ])->values()->all(),
            'music' => $this->music($post),
            'movie' => $post->movie_id ? $this->movies[$post->movie_id] ?? null : null,
            'link' => $post->link,
            'card' => $post->card,
            'saved' => isset($this->saved[$post->id]),
            'poll' => $this->pollCard($post),
            'shared' => $this->sharedCard($post),
            'muted' => isset($this->muted[$post->author_id]),
            'reaction' => $reaction,
            'liked' => $reaction !== null,
            'comments' => $comments,
            'can' => [
                'delete' => $viewer !== null && ($viewer->id === $post->author_id || $ownWall || $managesWall || $viewer->isStaff()),
                'edit' => $viewer !== null && $post->author_id === $viewer->id && ($post->is_draft || $post->publish_at?->isFuture() || $post->created_at->greaterThan(now()->subMinutes(Post::EDIT_MINUTES))),
                'pin' => $ownWall || $managesWall,
                'comment' => $viewer !== null && $post->comments_enabled,
                'hide' => $viewer !== null && $post->author_id !== $viewer->id && ! $post->is_draft && ! $post->publish_at?->isFuture(),
                'mute' => $viewer !== null && $post->author_id !== $viewer->id && ! $post->is_draft && ! $post->publish_at?->isFuture(),
                'share' => $shareable,
            ],
        ];
    }

    /**
     * @return array{name: string, username: string, href: string, body: string}|null
     */
    private function sharedCard(Post $post): ?array
    {
        $source = $post->sharedPost;
        $author = $source?->author;
        if ($source === null || $author === null) {
            return null;
        }

        return [
            'name' => $author->name,
            'username' => $author->username,
            'href' => '/'.$author->username,
            'body' => $source->spoiler ? 'Спойлер' : (string) $source->body,
        ];
    }

    /**
     * @return array{id: int, question: string, total: int, voted: int|null, options: list<array{id: int, label: string, votes: int}>}|null
     */
    private function pollCard(Post $post): ?array
    {
        $poll = $post->poll;
        if ($poll === null) {
            return null;
        }

        return [
            'id' => $poll->id,
            'question' => $poll->question,
            'total' => (int) $poll->options->sum('votes_count'),
            'voted' => isset($this->votes[$poll->id]) ? (int) $this->votes[$poll->id] : null,
            'options' => $poll->options->map(fn (PollOption $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'votes' => $option->votes_count,
            ])->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function music(Post $post): ?array
    {
        $music = $post->music;

        return match ($music['source'] ?? null) {
            'local' => $this->tracks[(int) $music['id']] ?? null,
            'spotify' => $music,
            default => null,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function comment(Comment $comment, ?User $viewer, bool $liked = false, bool $canPin = false): array
    {
        $comment->loadMissing('user');

        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'spoiler' => $comment->spoiler,
            'is_pinned' => (bool) $comment->is_pinned,
            'parent_id' => $comment->parent_id,
            'likes_count' => $comment->likes_count,
            'liked' => $liked,
            'created_at' => $comment->created_at->toIso8601String(),
            'user' => $comment->user->toCard(),
            'can_delete' => $viewer !== null && ($viewer->id === $comment->user_id || $viewer->isStaff()),
            'can_pin' => $canPin && $comment->parent_id === null,
        ];
    }
}
