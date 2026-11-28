<?php

namespace App\Services\Growth;

use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\FriendshipService;
use App\Services\Presence\SteamPresence;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Імпорт друзів (№279): хто з ваших друзів у Steam уже на GameCon (прив’язав Steam до профілю).
 * Список друзів Steam видно лише в публічних профілях Steam — інакше чесно кажемо, що закритий.
 * Заявки — звичайні (FriendshipService::request): блокування й батьківський контроль діють.
 */
class FriendImport
{
    /** Скільки людей GameCon показуємо за раз. */
    private const LIMIT = 200;

    public function __construct(
        private readonly SteamPresence $steam,
        private readonly FriendshipService $friendships,
    ) {}

    /**
     * @return array{status: 'ok'|'no_steam'|'private'|'off', people: list<array{user: array<string, mixed>, state: string}>}
     */
    public function steam(User $user): array
    {
        if (! $this->steam->configured()) {
            return ['status' => 'off', 'people' => []];
        }
        if ($user->steam_id === null) {
            return ['status' => 'no_steam', 'people' => []];
        }
        $ids = $this->steamFriendIds((string) $user->steam_id);
        if ($ids === null) {
            return ['status' => 'private', 'people' => []];
        }

        return ['status' => 'ok', 'people' => $this->people($user, $ids)];
    }

    /**
     * Надіслати заявки знайденим (кнопка «Додати всіх»). Лише тим, кого ми самі знайшли.
     *
     * @param  list<int>  $ids
     */
    public function addAll(User $user, array $ids): int
    {
        $found = array_filter($this->steam($user)['people'], fn (array $row) => $row['state'] === FriendshipService::NONE || $row['state'] === FriendshipService::INCOMING);
        $allowed = array_map(fn (array $row) => (int) $row['user']['id'], $found);
        $sent = 0;
        foreach (array_intersect($ids, $allowed) as $id) {
            $other = User::query()->find($id);
            if ($other === null) {
                continue;
            }
            try {
                $this->friendships->request($user, $other);
                $sent++;
            } catch (HttpException) {
                // Батьківський контроль чи інше обмеження — цю людину пропускаємо, решті надсилаємо.
            }
        }
        Log::info('friends: imported from steam', ['user' => $user->id, 'sent' => $sent]);

        return $sent;
    }

    /** @return list<string>|null null — список друзів у Steam закритий */
    private function steamFriendIds(string $steamId): ?array
    {
        /** @var list<string>|null */
        return Cache::remember("steam.friends.{$steamId}", 600, function () use ($steamId) {
            $data = $this->steam->get('ISteamUser/GetFriendList/v1/', ['steamid' => $steamId, 'relationship' => 'friend']);
            $list = is_array($data['friendslist'] ?? null) ? ($data['friendslist']['friends'] ?? null) : null;
            if (! is_array($list)) {
                return null;
            }
            $ids = [];
            foreach ($list as $friend) {
                if (is_array($friend) && is_string($friend['steamid'] ?? null) && preg_match('/^\d{17}$/', $friend['steamid']) === 1) {
                    $ids[] = $friend['steamid'];
                }
            }

            return $ids;
        });
    }

    /**
     * Люди GameCon із цими Steam ID: без себе, заблокованих (у будь-який бік), забанених і заморожених.
     *
     * @param  list<string>  $steamIds
     * @return list<array{user: array<string, mixed>, state: string}>
     */
    private function people(User $user, array $steamIds): array
    {
        if ($steamIds === []) {
            return [];
        }
        $blocked = UserBlock::query()->where('user_id', $user->id)->pluck('blocked_id')
            ->merge(UserBlock::query()->where('blocked_id', $user->id)->pluck('user_id'))->all();
        $users = User::query()->whereIn('steam_id', $steamIds)->whereKeyNot($user->id)
            ->whereNotIn('id', $blocked)->whereNull('banned_at')->whereNull('frozen_at')
            ->orderByDesc('last_seen_at')->limit(self::LIMIT)->get();
        $ids = $users->modelKeys();
        $links = Friendship::query()
            ->where(fn ($q) => $q->where('requester_id', $user->id)->whereIn('addressee_id', $ids))
            ->orWhere(fn ($q) => $q->where('addressee_id', $user->id)->whereIn('requester_id', $ids))
            ->get();

        $rows = [];
        foreach ($users as $other) {
            $link = $links->first(fn (Friendship $f) => $f->requester_id === $other->id || $f->addressee_id === $other->id);
            $rows[] = ['user' => $other->toCard(), 'state' => match (true) {
                $link === null => FriendshipService::NONE,
                $link->status === Friendship::ACCEPTED => FriendshipService::FRIENDS,
                $link->requester_id === $user->id => FriendshipService::OUTGOING,
                default => FriendshipService::INCOMING,
            }];
        }
        // Спершу ті, кого ще можна додати.
        usort($rows, fn (array $a, array $b) => ($a['state'] === FriendshipService::FRIENDS) <=> ($b['state'] === FriendshipService::FRIENDS));

        return $rows;
    }
}
