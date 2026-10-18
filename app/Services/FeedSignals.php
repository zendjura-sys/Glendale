<?php

namespace App\Services;

use App\Models\Post;
use App\Models\PostHide;
use App\Models\User;
use App\Models\UserMute;
use Illuminate\Database\Eloquent\Builder;

/** Приховує зі стрічки конкретні записи, заглушених людей і авторів, яких позначили «не цікаво». */
class FeedSignals
{
    /**
     * @param  Builder<Post>  $query
     */
    public function apply(Builder $query, User $viewer, bool $discover = false): void
    {
        $query->whereNotIn('id', PostHide::query()->where('user_id', $viewer->id)->select('post_id'));
        $query->whereNotIn('author_id', UserMute::query()->where('user_id', $viewer->id)->select('muted_id'));
        if ($discover) {
            $query->whereNotIn('author_id', PostHide::query()->where('user_id', $viewer->id)->select('author_id'));
        }
    }
}
