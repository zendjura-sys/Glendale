<?php

namespace App\Services\Profile;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Статистика автора за 30 днів (лише для себе): записи, перегляди, вподобання й коментарі,
 * щоденний графік реакцій і найкращі записи.
 */
class AuthorStats
{
    public const DAYS = 30;

    /**
     * @return array{totals: array{posts: int, views: int, likes: int, comments: int}, days: list<array{day: string, likes: int, comments: int}>, top: list<array{id: int, excerpt: string, views: int, likes: int, comments: int, created_at: string}>}
     */
    public function for(User $user): array
    {
        $since = now()->subDays(self::DAYS - 1)->startOfDay();
        $posts = Post::query()->where('author_id', $user->id)->where('is_draft', false)->where('created_at', '>=', $since);
        $postIds = Post::query()->where('author_id', $user->id)->select('id');

        $likes = Like::query()->where('likeable_type', 'post')->whereIn('likeable_id', $postIds)
            ->where('user_id', '!=', $user->id)->where('created_at', '>=', $since)->pluck('created_at');
        $comments = Comment::query()->whereIn('post_id', $postIds)->where('user_id', '!=', $user->id)
            ->where('created_at', '>=', $since)->pluck('created_at');

        /** @param  Collection<int, mixed>  $dates */
        $byDay = function ($dates): array {
            $counts = [];
            foreach ($dates as $date) {
                $key = $date instanceof \DateTimeInterface ? $date->format('Y-m-d') : substr((string) $date, 0, 10);
                $counts[$key] = ($counts[$key] ?? 0) + 1;
            }

            return $counts;
        };
        $likeDays = $byDay($likes);
        $commentDays = $byDay($comments);
        $days = [];
        for ($i = 0; $i < self::DAYS; $i++) {
            $day = $since->addDays($i)->toDateString();
            $days[] = ['day' => $day, 'likes' => (int) ($likeDays[$day] ?? 0), 'comments' => (int) ($commentDays[$day] ?? 0)];
        }

        $top = (clone $posts)->orderByDesc('views_count')->orderByDesc('likes_count')->limit(5)
            ->get(['id', 'body', 'views_count', 'likes_count', 'comments_count', 'created_at'])
            ->map(fn (Post $post) => [
                'id' => $post->id,
                'excerpt' => Str::limit(trim((string) $post->body), 90) ?: 'Запис без тексту',
                'views' => $post->views_count,
                'likes' => $post->likes_count,
                'comments' => $post->comments_count,
                'created_at' => $post->created_at->toIso8601String(),
            ])->all();
        $top = array_values($top);

        return [
            'totals' => [
                'posts' => (clone $posts)->count(),
                'views' => (int) (clone $posts)->sum('views_count'),
                'likes' => $likes->count(),
                'comments' => $comments->count(),
            ],
            'days' => $days,
            'top' => $top,
        ];
    }
}
