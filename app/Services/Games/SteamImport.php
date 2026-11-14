<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\User;
use App\Services\Presence\PlayingStatus;
use App\Services\Presence\SteamPresence;
use Illuminate\Support\Facades\Log;

/**
 * Імпорт бібліотеки Steam у беклог: ігри з каталогу GameCon, які є в Steam людини,
 * з підказкою стану (грає останні два тижні → «Граю», є години → «Пройшов», без годин → «Хочу пограти»).
 * Ігри, які вже є в беклозі, не перезаписуються — людина сама вирішує їхній стан.
 */
class SteamImport
{
    public function __construct(private readonly SteamPresence $steam, private readonly PlayingStatus $status) {}

    /**
     * Попередній перегляд: збіги з каталогом і скільки ігор без пари.
     *
     * @return array{connected: bool, matched: list<array<string, mixed>>, unmatched: int, total: int}
     */
    public function preview(User $user): array
    {
        if ($user->steam_id === null || ! $this->steam->configured()) {
            return ['connected' => false, 'matched' => [], 'unmatched' => 0, 'total' => 0];
        }
        $owned = $this->steam->owned($user);
        $map = $this->status->steamApps();
        $ids = [];
        foreach ($owned as $g) {
            if (isset($map[$g['app_id']])) {
                $ids[$map[$g['app_id']]] = $g;
            }
        }
        $games = Game::query()->whereIn('id', array_keys($ids))->get(['id', 'slug', 'name', 'cover'])->keyBy('id');
        $have = GameBacklog::query()->where('user_id', $user->id)->pluck('status', 'game_id');
        $matched = [];
        foreach ($ids as $gameId => $g) {
            $game = $games->get($gameId);
            if (! $game) {
                continue;
            }
            $matched[] = [
                'id' => $game->id, 'slug' => $game->slug, 'name' => $game->name, 'cover' => $game->cover,
                'hours' => intdiv($g['minutes'], 60), 'recent' => $g['recent'] > 0,
                'suggested' => $this->suggest($g), 'current' => $have[$game->id] ?? null,
            ];
        }
        usort($matched, fn ($a, $b) => $b['hours'] <=> $a['hours']);

        return ['connected' => true, 'matched' => $matched, 'unmatched' => count($owned) - count($matched), 'total' => count($owned)];
    }

    /**
     * @param  array{minutes: int, recent: int}  $g
     */
    private function suggest(array $g): string
    {
        return match (true) {
            $g['recent'] > 0 => GameBacklog::PLAYING,
            $g['minutes'] > 0 => GameBacklog::DONE,
            default => GameBacklog::WANT,
        };
    }

    /**
     * Імпортувати обрані ігри зі станами. Повертає, скільки додано.
     *
     * @param  array<int, string>  $choices  game_id → стан
     */
    public function import(User $user, array $choices): int
    {
        $allowed = collect($this->preview($user)['matched'])->keyBy('id');
        $added = 0;
        foreach ($choices as $gameId => $status) {
            if (! $allowed->has((int) $gameId) || ! in_array($status, GameBacklog::STATUSES, true)) {
                continue;
            }
            $row = GameBacklog::query()->firstOrCreate(['user_id' => $user->id, 'game_id' => (int) $gameId], ['status' => $status]);
            if ($row->wasRecentlyCreated) {
                $added++;
            }
        }
        Log::info('steam: library imported', ['user' => $user->id, 'added' => $added]);

        return $added;
    }
}
