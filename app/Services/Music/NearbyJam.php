<?php

namespace App\Services\Music;

use App\Models\ListenParty;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\ListenParties;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * «Автоматично запрошувати друзів поблизу в джем» (як у Spotify): поблизу — друзі, у яких
 * GameCon відкритий у тій самій мережі (та сама зовнішня IP) останні 10 хвилин.
 * Мережу бачимо з heartbeat GameCon Connect; IP не зберігаємо — лише її хеш у кеші.
 */
class NearbyJam
{
    public const PREF = 'jam_auto_invite';

    private const WINDOW = 600;

    public function seen(User $user, ?string $ip): void
    {
        if ($ip === null || $ip === '') {
            return;
        }
        $key = $this->key($ip);
        $now = time();
        $list = array_filter((array) Cache::get($key, []), fn ($at) => is_int($at) && $now - $at < self::WINDOW);
        $list[$user->id] = $now;
        Cache::put($key, $list, self::WINDOW);
    }

    /**
     * Друзі в тій самій мережі зараз.
     *
     * @return list<int>
     */
    public function nearbyFriends(User $user, ?string $ip): array
    {
        if ($ip === null || $ip === '') {
            return [];
        }
        $now = time();
        $ids = array_keys(array_filter((array) Cache::get($this->key($ip), []), fn ($at) => is_int($at) && $now - $at < self::WINDOW));
        $ids = array_values(array_filter(array_map('intval', $ids), fn (int $id) => $id !== $user->id));
        if ($ids === []) {
            return [];
        }

        return app(FriendshipService::class)->friendsQuery($user)->whereIn('users.id', $ids)->pluck('users.id')->map(fn ($id) => (int) $id)->all();
    }

    /** Після старту джему: запросити друзів поблизу, якщо людина це ввімкнула. */
    public function autoInvite(ListenParty $party, User $host, ?string $ip): int
    {
        if (! $host->pref(self::PREF, false)) {
            return 0;
        }
        $friends = $this->nearbyFriends($host, $ip);
        if ($friends === []) {
            return 0;
        }
        $sent = app(ListenParties::class)->invite($party, $host, $friends);
        Log::info('music.jam.auto_invite', ['user_id' => $host->id, 'party' => $party->code, 'sent' => $sent]);

        return $sent;
    }

    private function key(string $ip): string
    {
        return 'jam_near:'.hash('sha256', $ip.config('app.key'));
    }
}
