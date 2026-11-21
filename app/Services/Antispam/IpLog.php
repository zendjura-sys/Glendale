<?php

namespace App\Services\Antispam;

use App\Models\LoginEvent;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Support\Collection;

/**
 * Журнал IP для адмінки: з яких адрес входив акаунт і хто ще входив з тієї ж адреси.
 * Дані — з журналу входів і активних сесій (окремо IP ми не збираємо).
 */
class IpLog
{
    /**
     * @return array{query: string, kind: 'ip'|'user'|'none', user: array<string, mixed>|null, rows: list<array<string, mixed>>}
     */
    public function lookup(string $query): array
    {
        $query = trim($query);
        if ($query === '') {
            return ['query' => '', 'kind' => 'none', 'user' => null, 'rows' => []];
        }
        if (preg_match('/^[0-9a-f:.\/]+$/i', $query) === 1 && (str_contains($query, '.') || str_contains($query, ':'))) {
            return ['query' => $query, 'kind' => 'ip', 'user' => null, 'rows' => $this->accountsOn($query)];
        }
        $user = User::query()->where('username', ltrim($query, '@'))->orWhere('email', $query)->first();

        return [
            'query' => $query,
            'kind' => 'user',
            'user' => $user?->toCard(),
            'rows' => $user ? $this->addressesOf($user) : [],
        ];
    }

    /**
     * Адреси акаунта: скільки входів, коли востаннє, скільки інших акаунтів з цієї адреси.
     *
     * @return list<array<string, mixed>>
     */
    private function addressesOf(User $user): array
    {
        $logins = LoginEvent::query()->where('user_id', $user->id)->whereNotNull('ip')
            ->selectRaw('ip, count(*) as hits, max(created_at) as last_at')->groupBy('ip')->get();
        $sessions = UserSession::query()->where('user_id', $user->id)->whereNotNull('ip')
            ->selectRaw('ip, max(last_active_at) as last_at')->groupBy('ip')->get();

        $rows = collect();
        foreach ([...$logins, ...$sessions] as $row) {
            $ip = (string) $row->getAttribute('ip');
            $current = $rows->get($ip, ['ip' => $ip, 'logins' => 0, 'last_at' => null]);
            $current['logins'] += (int) ($row->getAttribute('hits') ?? 0);
            $last = (string) $row->getAttribute('last_at');
            $current['last_at'] = max((string) $current['last_at'], $last);
            $rows->put($ip, $current);
        }
        $ips = array_values(array_map('strval', $rows->keys()->all()));
        $others = $this->usersByIp($ips)->map(fn (Collection $ids) => $ids->reject(fn (int $id) => $id === $user->id)->count());
        $bans = app(IpBans::class);

        return array_values($rows->map(fn (array $row) => [
            ...$row,
            'others' => (int) ($others[$row['ip']] ?? 0),
            'banned' => $bans->banned($row['ip']) !== null,
        ])->sortByDesc('last_at')->take(50)->all());
    }

    /**
     * Акаунти, що входили з адреси (або підмережі CIDR).
     *
     * @return list<array<string, mixed>>
     */
    private function accountsOn(string $ip): array
    {
        $exact = ! str_contains($ip, '/');
        $match = fn ($q) => $exact ? $q->where('ip', $ip) : $q->where('ip', 'like', $this->prefix($ip).'%');
        $logins = LoginEvent::query()->whereNotNull('ip')->where($match)
            ->selectRaw('user_id, ip, count(*) as hits, max(created_at) as last_at')->groupBy('user_id', 'ip')->get();
        $sessions = UserSession::query()->whereNotNull('ip')->where($match)
            ->selectRaw('user_id, ip, max(last_active_at) as last_at')->groupBy('user_id', 'ip')->get();
        $users = User::query()->whereIn('id', [...$logins->pluck('user_id'), ...$sessions->pluck('user_id')])->get()->keyBy('id');

        $rows = collect();
        foreach ([...$logins, ...$sessions] as $row) {
            $id = (int) $row->getAttribute('user_id');
            $user = $users->get($id);
            if (! $user instanceof User) {
                continue;
            }
            $current = $rows->get($id, ['user' => $user->toCard(), 'ip' => (string) $row->getAttribute('ip'), 'logins' => 0, 'last_at' => null, 'banned' => $user->isBanned()]);
            $current['logins'] += (int) ($row->getAttribute('hits') ?? 0);
            $current['last_at'] = max((string) $current['last_at'], (string) $row->getAttribute('last_at'));
            $rows->put($id, $current);
        }

        return array_values($rows->sortByDesc('last_at')->take(100)->all());
    }

    /**
     * @param  list<string>  $ips
     * @return Collection<string, Collection<int, int>>
     */
    private function usersByIp(array $ips): Collection
    {
        if ($ips === []) {
            return collect();
        }
        $pairs = LoginEvent::query()->whereIn('ip', $ips)->distinct()->get(['ip', 'user_id'])
            ->concat(UserSession::query()->whereIn('ip', $ips)->distinct()->get(['ip', 'user_id']));

        return $pairs->groupBy('ip')->map(fn (Collection $group) => $group->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->values());
    }

    /** Для підмережі шукаємо за спільним початком адреси (1.2.3.0/24 → «1.2.3.»). */
    private function prefix(string $cidr): string
    {
        [$address, $mask] = explode('/', $cidr, 2);
        if (str_contains($address, ':')) {
            return implode(':', array_slice(explode(':', $address), 0, max(1, intdiv((int) $mask, 16)))).':';
        }
        $octets = max(1, min(3, intdiv((int) $mask, 8)));

        return implode('.', array_slice(explode('.', $address), 0, $octets)).'.';
    }
}
