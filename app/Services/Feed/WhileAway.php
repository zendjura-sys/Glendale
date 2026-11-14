<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Support\NotifyPrefs;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * «Поки вас не було»: коротке зведення в стрічці, якщо людина не заходила понад 12 годин —
 * скільки записали друзі, найпопулярніші записи, заявки в друзі, непрочитані сповіщення, нові треки друзів.
 */
class WhileAway
{
    /** Після скількох годин відсутності показуємо зведення. */
    public const HOURS = 12;

    public function __construct(private readonly FriendshipService $friendships) {}

    /**
     * Зведення з часу попереднього відкриття стрічки й позначка «бачив зараз».
     * Позначку оновлюємо лише на повному відкритті сторінки (не на догрузках і частинах).
     *
     * @return array<string, mixed>|null
     */
    public function take(User $user, bool $touch): ?array
    {
        $seen = $user->pref('feed_seen_at');
        $since = is_string($seen) ? Carbon::parse($seen) : null;
        if ($touch) {
            $user->mergePref(['feed_seen_at' => now()->toIso8601String()]);
        }
        if ($since === null || $since->gt(now()->subHours(self::HOURS))) {
            return null;
        }

        return $this->summary($user, $since);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function summary(User $user, Carbon $since): ?array
    {
        $friends = $this->friendships->friendIds($user);
        $postQuery = Post::query()->whereIn('author_id', $friends === [] ? [0] : $friends)
            ->where('is_draft', false)->where('created_at', '>=', $since);
        $posts = (clone $postQuery)->count();
        $top = $posts === 0 ? collect() : (clone $postQuery)->with('author')
            ->withCount('likes as likes_total')
            ->orderByDesc('likes_total')->orderByDesc('id')->limit(3)->get();
        $requests = $this->friendships->incomingCount($user);
        $notifications = NotifyPrefs::unreadCount($user);
        $tracks = Track::query()->whereIn('user_id', $friends === [] ? [0] : $friends)->where('created_at', '>=', $since)->count();

        if ($posts + $requests + $notifications + $tracks === 0) {
            return null;
        }

        return [
            'hours' => (int) floor($since->diffInHours(now(), true)),
            'posts' => $posts,
            'requests' => $requests,
            'notifications' => $notifications,
            'tracks' => $tracks,
            'top' => $top->map(fn (Post $post) => [
                'id' => $post->id,
                'author' => $post->author?->toCard(),
                'excerpt' => Str::limit(trim(preg_replace('/\s+/u', ' ', (string) $post->body) ?? ''), 90),
                'likes' => (int) ($post->likes_total ?? 0),
            ])->values()->all(),
        ];
    }
}
