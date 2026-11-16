<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class PostPresenter
{
    public const PREVIEW_COMMENTS = 2;

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

        $posts->loadMissing(['author', 'wall', 'attachments']);
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

        $likedPostIds = $viewer ? Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Post)->getMorphClass())
            ->whereIn('likeable_id', $ids)
            ->pluck('likeable_id')
            ->flip()
            ->all() : [];

        $commentIds = $previewComments->flatten()->pluck('id')->all();
        $likedCommentIds = $viewer && $commentIds ? Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $commentIds)
            ->pluck('likeable_id')
            ->flip()
            ->all() : [];

        return $posts->map(fn (Post $post) => $this->present(
            $post,
            $viewer,
            isset($likedPostIds[$post->id]),
            ($previewComments[$post->id] ?? collect())->map(fn (Comment $c) => $this->comment($c, $viewer, isset($likedCommentIds[$c->id])))->values()->all(),
        ))->values()->all();
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
    private function present(Post $post, ?User $viewer, bool $liked, array $comments): array
    {
        $wall = $post->wall;
        $onForeignWall = $wall instanceof User && $wall->id !== $post->author_id;

        return [
            'id' => $post->id,
            'body' => $post->body,
            'visibility' => $post->visibility,
            'is_pinned' => $post->is_pinned,
            'comments_enabled' => $post->comments_enabled,
            'likes_count' => $post->likes_count,
            'comments_count' => $post->comments_count,
            'views_count' => $post->views_count,
            'created_at' => $post->created_at->toIso8601String(),
            'author' => $post->author->toCard(),
            'wall' => $onForeignWall ? $wall->toCard() : null,
            'attachments' => $post->attachments->map(fn (PostAttachment $a) => [
                'id' => $a->id,
                'type' => $a->type,
                'url' => $a->url,
                'width' => $a->width,
                'height' => $a->height,
            ])->values()->all(),
            'liked' => $liked,
            'comments' => $comments,
            'can' => [
                'delete' => $viewer !== null && ($viewer->id === $post->author_id || ($wall instanceof User && $wall->id === $viewer->id) || $viewer->isStaff()),
                'pin' => $viewer !== null && $wall instanceof User && $wall->id === $viewer->id,
                'comment' => $viewer !== null && $post->comments_enabled,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function comment(Comment $comment, ?User $viewer, bool $liked = false): array
    {
        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'parent_id' => $comment->parent_id,
            'likes_count' => $comment->likes_count,
            'liked' => $liked,
            'created_at' => $comment->created_at->toIso8601String(),
            'user' => $comment->user->toCard(),
            'can_delete' => $viewer !== null && ($viewer->id === $comment->user_id || $viewer->isStaff()),
        ];
    }
}
