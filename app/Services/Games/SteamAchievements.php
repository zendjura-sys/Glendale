<?php

namespace App\Services\Games;

use App\Models\User;
use App\Services\Presence\SteamPresence;
use Illuminate\Support\Facades\Cache;

/**
 * Досягнення Steam людини: прогрес у грі, найрідкісніші відкриті (за глобальним відсотком гравців).
 * Потрібні ключ Steam в адмінці й прив’язаний відкритий профіль. Кеш 6 год.
 */
class SteamAchievements
{
    public function __construct(private readonly SteamPresence $steam) {}

    /**
     * @return array{app_id: string, game: string|null, unlocked: int, total: int, rarest: list<array{name: string, description: string|null, icon: string|null, percent: float}>}|null
     */
    public function forApp(User $user, string $appId): ?array
    {
        if ($user->steam_id === null || ! $this->steam->configured()) {
            return null;
        }
        $key = "steam.ach.{$user->steam_id}.{$appId}";
        $value = Cache::get($key);
        if (! is_array($value)) {
            $value = $this->fetch((string) $user->steam_id, $appId) ?? [];
            Cache::put($key, $value, $value === [] ? now()->addHour() : now()->addHours(6));
        }

        if (! isset($value['app_id'], $value['unlocked'], $value['total'], $value['rarest']) || ! is_array($value['rarest'])) {
            return null;
        }

        return [
            'app_id' => (string) $value['app_id'],
            'game' => isset($value['game']) ? (string) $value['game'] : null,
            'unlocked' => (int) $value['unlocked'],
            'total' => (int) $value['total'],
            'rarest' => array_values(array_map(fn ($a) => [
                'name' => (string) ($a['name'] ?? ''),
                'description' => isset($a['description']) ? (string) $a['description'] : null,
                'icon' => isset($a['icon']) ? (string) $a['icon'] : null,
                'percent' => (float) ($a['percent'] ?? 100),
            ], array_filter($value['rarest'], 'is_array'))),
        ];
    }

    /**
     * Найдовше зіграні ігри з досягненнями (для профілю).
     *
     * @return list<array<string, mixed>>
     */
    public function showcase(User $user, int $games = 3): array
    {
        if ($user->steam_id === null || ! $this->steam->configured()) {
            return [];
        }
        $out = [];
        foreach ($this->steam->library($user, 8) as $item) {
            $appId = (string) ($item['app_id'] ?? '');
            if ($appId === '') {
                continue;
            }
            $data = $this->forApp($user, $appId);
            if ($data !== null && $data['total'] > 0) {
                $out[] = [...$data, 'game' => $item['name'], 'hours' => $item['hours']];
            }
            if (count($out) >= $games) {
                break;
            }
        }

        return $out;
    }

    /**
     * @return array{app_id: string, game: string|null, unlocked: int, total: int, rarest: list<array{name: string, description: string|null, icon: string|null, percent: float}>}|null
     */
    private function fetch(string $steamId, string $appId): ?array
    {
        $player = $this->steam->get('ISteamUserStats/GetPlayerAchievements/v1/', ['steamid' => $steamId, 'appid' => $appId, 'l' => 'ukrainian']);
        $list = is_array($player['playerstats'] ?? null) ? ($player['playerstats']['achievements'] ?? null) : null;
        if (! is_array($list) || $list === []) {
            return null;
        }
        $schema = $this->steam->get('ISteamUserStats/GetSchemaForGame/v2/', ['appid' => $appId, 'l' => 'ukrainian']);
        $defs = [];
        foreach ((array) ($schema['game']['availableGameStats']['achievements'] ?? []) as $def) {
            if (is_array($def) && isset($def['name'])) {
                $defs[(string) $def['name']] = $def;
            }
        }
        $global = $this->steam->get('ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/', ['gameid' => $appId]);
        $percent = [];
        foreach ((array) ($global['achievementpercentages']['achievements'] ?? []) as $row) {
            if (is_array($row) && isset($row['name'])) {
                $percent[(string) $row['name']] = (float) ($row['percent'] ?? 100);
            }
        }

        $unlocked = [];
        foreach ($list as $item) {
            if (is_array($item) && (int) ($item['achieved'] ?? 0) === 1) {
                $name = (string) ($item['apiname'] ?? '');
                $def = $defs[$name] ?? [];
                $unlocked[] = [
                    'name' => (string) ($def['displayName'] ?? $item['name'] ?? $name),
                    'description' => isset($def['description']) ? (string) $def['description'] : null,
                    'icon' => isset($def['icon']) ? (string) $def['icon'] : null,
                    'percent' => round($percent[$name] ?? 100, 1),
                ];
            }
        }
        usort($unlocked, fn (array $a, array $b) => $a['percent'] <=> $b['percent']);

        return [
            'app_id' => $appId,
            'game' => isset($player['playerstats']['gameName']) ? (string) $player['playerstats']['gameName'] : null,
            'unlocked' => count($unlocked),
            'total' => count($list),
            'rarest' => array_slice($unlocked, 0, 5),
        ];
    }
}
