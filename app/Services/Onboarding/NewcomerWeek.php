<?php

namespace App\Services\Onboarding;

use App\Models\Follow;
use App\Models\GameBacklog;
use App\Models\PartyMember;
use App\Models\PartyPost;
use App\Models\Post;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Services\FriendshipService;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\DB;

/**
 * «Тиждень новачка»: перші 7 днів — картка з простими кроками (аватар, ігри, друг,
 * спільнота, перший запис, паті). Виконане позначається само; картку можна сховати.
 */
class NewcomerWeek
{
    public const DAYS = 7;

    public function __construct(private readonly FriendshipService $friendships) {}

    /**
     * @return array{day: int, days: int, done: int, total: int, steps: list<array{key: string, done: bool, href: string}>}|null
     */
    public function forUser(User $user): ?array
    {
        if (! app(Plugins::class)->on('newcomer_week') || $user->pref('newcomer_hidden')
            || $user->created_at === null || $user->created_at->lt(now()->subDays(self::DAYS))) {
            return null;
        }
        $steps = [
            ['key' => 'avatar', 'done' => $user->avatar_path !== null, 'href' => '/settings/profile'],
            ['key' => 'about', 'done' => trim((string) $user->status) !== '' || trim((string) $user->about) !== '', 'href' => '/settings/profile'],
            ['key' => 'games', 'done' => GameBacklog::query()->where('user_id', $user->id)->exists()
                || Follow::query()->where('user_id', $user->id)->where('kind', Follow::GAME)->exists()
                || TeammateProfile::query()->where('user_id', $user->id)->whereNotNull('games')->exists(), 'href' => '/games'],
            ['key' => 'friend', 'done' => $this->friendships->friendIds($user) !== [], 'href' => '/people'],
            ['key' => 'community', 'done' => DB::table('community_members')->where('user_id', $user->id)->exists(), 'href' => '/communities'],
            ['key' => 'post', 'done' => Post::query()->where('author_id', $user->id)->where('is_draft', false)->exists(), 'href' => '/feed'],
            ['key' => 'party', 'done' => PartyPost::query()->where('user_id', $user->id)->exists()
                || PartyMember::query()->where('user_id', $user->id)->exists(), 'href' => '/party'],
        ];
        $done = count(array_filter($steps, fn (array $s) => $s['done']));

        return [
            'day' => min(self::DAYS, (int) $user->created_at->startOfDay()->diffInDays(now()->startOfDay()) + 1),
            'days' => self::DAYS,
            'done' => $done,
            'total' => count($steps),
            'steps' => $steps,
        ];
    }
}
