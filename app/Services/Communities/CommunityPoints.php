<?php

namespace App\Services\Communities;

use App\Models\Comment;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Post;
use App\Support\Plugins\Plugins;

/**
 * Бали учасника спільноти: запис на стіні — 5, коментар — 1, «Буду» на події — 3.
 * Керівники можуть додати чи зняти бали вручну (у журнал).
 */
class CommunityPoints
{
    public const POST = 5;

    public const COMMENT = 1;

    public const EVENT = 3;

    public function award(int $communityId, int $userId, int $points): void
    {
        if ($points === 0 || ! app(Plugins::class)->on('community_points')) {
            return;
        }
        CommunityMember::query()->where('community_id', $communityId)->where('user_id', $userId)
            ->where('status', CommunityMember::STATUS_ACTIVE)->increment('points', $points);
    }

    public function forPost(Post $post): void
    {
        if ($post->wall_type === (new Community)->getMorphClass() && ! $post->is_draft && ! $post->is_pending && ($post->publish_at === null || $post->publish_at->isPast())) {
            $this->award($post->wall_id, $post->author_id, self::POST);
        }
    }

    public function forComment(Comment $comment): void
    {
        $post = $comment->post_id ? Post::query()->find($comment->post_id, ['id', 'wall_type', 'wall_id']) : null;
        if ($post !== null && $post->wall_type === (new Community)->getMorphClass()) {
            $this->award($post->wall_id, $comment->user_id, self::COMMENT);
        }
    }

    /**
     * Найактивніші учасники.
     *
     * @return list<array<string, mixed>>
     */
    public function top(Community $community, int $limit = 10): array
    {
        return array_values(CommunityMember::query()->with('user')->where('community_id', $community->id)
            ->where('status', CommunityMember::STATUS_ACTIVE)->where('points', '>', 0)
            ->orderByDesc('points')->orderBy('id')->limit($limit)->get()
            ->filter(fn (CommunityMember $m) => $m->user !== null)
            ->map(fn (CommunityMember $m) => [...$m->user->toCard(), 'points' => $m->points])->all());
    }
}
