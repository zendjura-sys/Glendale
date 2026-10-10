<?php

namespace App\Services;

use App\Jobs\RelayToBots;
use App\Models\Community;
use App\Models\Post;
use App\Models\User;
use App\Notifications\PostInteraction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Публікує записи, чий час настав, і сповіщає згаданих лише тоді. */
class ScheduledPosts
{
    public function publishDue(): int
    {
        $due = Post::query()
            ->where('is_draft', false)
            ->where('is_pending', false)
            ->whereNotNull('publish_at')
            ->where('publish_at', '<=', now())
            ->orderBy('id')
            ->limit(100)
            ->get();

        $count = 0;
        foreach ($due as $post) {
            $published = false;
            DB::transaction(function () use ($post, &$published) {
                $fresh = Post::query()->whereKey($post->id)->lockForUpdate()->first();
                if (! $fresh instanceof Post || $fresh->is_draft || $fresh->is_pending || $fresh->publish_at === null || $fresh->publish_at->isFuture()) {
                    return;
                }
                $at = $fresh->publish_at;
                $fresh->forceFill(['publish_at' => null, 'created_at' => $at])->save();
                $this->announce($fresh);
                $published = true;
            });
            if ($published) {
                $count++;
            }
        }

        return $count;
    }

    public function announce(Post $post): void
    {
        $post->loadMissing('author', 'wall');
        $wall = $post->wall;
        if ($wall instanceof User && $post->author && $wall->isNot($post->author)) {
            $excerpt = $post->spoiler ? 'Спойлер' : Str::limit((string) $post->body, 80);
            $wall->notify(new PostInteraction(PostInteraction::WALL, $post->author, $post, $excerpt));
        }

        if ($post->author) {
            app(Mentions::class)->notify($post->author, $post->body, route('posts.show', $post, absolute: false));
        }

        // Пост спільноти — і в її чати Telegram / Discord, якщо керівники це ввімкнули.
        if ($wall instanceof Community) {
            RelayToBots::maybe('community', $wall->id, 'post', $post->id);
        }
    }
}
