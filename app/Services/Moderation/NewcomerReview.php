<?php

namespace App\Services\Moderation;

use App\Models\LoginEvent;
use App\Models\Post;
use App\Models\User;
use App\Models\UserReport;
use Illuminate\Support\Facades\Log;

/**
 * Черга новачків: акаунти до 7 днів, які ще ніхто не переглянув, — з ознаками ризику
 * (посилання в записах, скарги, вхід з тієї ж адреси, що й заблоковані, непідтверджена пошта).
 */
class NewcomerReview
{
    public const DAYS = 7;

    /**
     * @return list<array<string, mixed>>
     */
    public function queue(int $limit = 40): array
    {
        $users = User::query()->where('created_at', '>=', now()->subDays(self::DAYS))
            ->whereNull('banned_at')->where('role', User::ROLE_USER)
            ->latest('id')->limit(300)->get()
            ->filter(fn (User $u) => $u->pref('newcomer_reviewed_at') === null);
        if ($users->isEmpty()) {
            return [];
        }
        $ids = $users->pluck('id')->all();
        $posts = Post::query()->toBase()->whereIn('author_id', $ids)->selectRaw('author_id, count(*) as total, sum(case when body like ? then 1 else 0 end) as links', ['%http%'])->groupBy('author_id')->get()->keyBy('author_id');
        $reports = UserReport::query()->whereIn('user_id', $ids)->selectRaw('user_id, count(*) as total')->groupBy('user_id')->pluck('total', 'user_id');
        $bannedIps = LoginEvent::query()->whereIn('user_id', User::query()->whereNotNull('banned_at')->select('id'))->whereNotNull('ip')->distinct()->pluck('ip')->all();
        $sharedIp = $bannedIps === [] ? [] : LoginEvent::query()->whereIn('user_id', $ids)->whereIn('ip', $bannedIps)->distinct()->pluck('user_id')->all();

        $rows = $users->map(function (User $u) use ($posts, $reports, $sharedIp) {
            $p = $posts->get($u->id);
            $signals = array_values(array_filter([
                (int) ($reports[$u->id] ?? 0) > 0 ? 'Скарг: '.(int) $reports[$u->id] : null,
                (int) ($p->links ?? 0) > 0 ? 'Записів з посиланнями: '.(int) $p->links : null,
                in_array($u->id, $sharedIp, true) ? 'Вхід з адреси заблокованого акаунта' : null,
                $u->email_verified_at === null ? 'Пошту не підтверджено' : null,
                $u->avatar_path === null ? 'Без аватара' : null,
            ]));
            $risk = (int) ($reports[$u->id] ?? 0) * 3 + min(5, (int) ($p->links ?? 0)) * 2 + (in_array($u->id, $sharedIp, true) ? 6 : 0) + ($u->email_verified_at === null ? 1 : 0) + ($u->avatar_path === null ? 1 : 0);

            return [...$u->toCard(), 'created_at' => $u->created_at?->toIso8601String(), 'posts' => (int) ($p->total ?? 0), 'signals' => $signals, 'risk' => $risk];
        })->sortByDesc('risk')->take($limit);

        return array_values($rows->all());
    }

    public function markReviewed(User $user, ?User $moderator): void
    {
        $user->mergePref(['newcomer_reviewed_at' => now()->toIso8601String()]);
        Log::info('admin: newcomer reviewed', ['user' => $user->id, 'by' => $moderator?->id]);
    }
}
