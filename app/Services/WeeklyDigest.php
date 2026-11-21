<?php

namespace App\Services;

use App\Models\GameGiveaway;
use App\Models\Movie;
use App\Models\Post;
use App\Models\User;
use App\Notifications\WeeklyDigestNotice;
use App\Support\NetworkModes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Щотижневий дайджест (неділя, 18:00 за Києвом): найкраще в друзів за тиждень, нові серії того,
 * що людина дивиться, роздачі ігор. Порожній тиждень — не надсилаємо. Розділи — з режиму людини.
 */
class WeeklyDigest
{
    public function __construct(private readonly FriendshipService $friendships) {}

    public function sendAll(): int
    {
        $sent = 0;
        User::query()->whereNull('banned_at')->whereNull('frozen_at')->where('last_seen_at', '>=', now()->subDays(60))
            ->orderBy('id')->chunkById(200, function ($users) use (&$sent) {
                foreach ($users as $user) {
                    if ($user->pref('weekly_digest', true) === false) {
                        continue;
                    }
                    $lines = $this->lines($user);
                    if ($lines === []) {
                        continue;
                    }
                    $user->notify(new WeeklyDigestNotice($lines));
                    $sent++;
                }
            });

        return $sent;
    }

    /**
     * @return list<string>
     */
    public function lines(User $user): array
    {
        $since = now()->subWeek();
        $modules = app(NetworkModes::class)->modulesFor($user);
        $lines = [];

        // Найкраще в друзів: запис тижня з найбільшою кількістю вподобань.
        $friends = $this->friendships->friendIds($user);
        if ($friends !== []) {
            $best = Post::query()->with('author')->whereIn('author_id', $friends)->where('is_draft', false)
                ->where('created_at', '>=', $since)->withCount('likes')->orderByDesc('likes_count')->first();
            if ($best && $best->likes_count > 0 && $best->author) {
                $lines[] = 'Найкраще в друзів: '.$best->author->name.' — «'.Str::limit(trim((string) $best->body), 60).'» ('.$best->likes_count.' ♥)';
            }
        }

        // Нові серії того, що людина дивиться (тайтл оновився за тиждень).
        if (in_array('cinema', $modules, true)) {
            $titles = Movie::query()->whereIn('id', DB::table('movie_user')->where('user_id', $user->id)->where('status', 'watching')->select('movie_id'))
                ->where('updated_at', '>=', $since)->whereNotNull('episodes_count')->limit(3)->pluck('title');
            if ($titles->isNotEmpty()) {
                $lines[] = 'Нові серії: '.$titles->join(', ');
            }
        }

        // Роздачі ігор, що досі тривають.
        if (in_array('games', $modules, true)) {
            $free = GameGiveaway::query()->where('active', true)->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))->count();
            if ($free > 0) {
                $lines[] = 'Безкоштовних ігор зараз: '.$free;
            }
        }

        return $lines;
    }
}
