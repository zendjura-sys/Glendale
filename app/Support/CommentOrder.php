<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

/** Порядок коментарів: закріплені завжди зверху, далі нові, старі або за реакціями. */
class CommentOrder
{
    /**
     * @param  Builder<\App\Models\Comment>|Relation<\App\Models\Comment, *, *>  $query
     */
    public static function apply(Builder|Relation $query, mixed $sort): void
    {
        $query->orderByDesc('is_pinned');

        match ($sort) {
            'new' => $query->orderByDesc('id'),
            'reactions' => $query->orderByDesc('likes_count')->orderByDesc('id'),
            default => $query->orderBy('id'),
        };
    }
}
