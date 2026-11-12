<?php

namespace App\Services\Games;

use App\Models\Game;
use Illuminate\Support\Facades\DB;

/**
 * Історія ціни гри: найкраща пропозиція за день. Точку записуємо щоразу, коли дізнаємось ціну
 * (сторінка гри, нічна перевірка вішлистів) — без окремих запитів до магазинів.
 */
class GamePrices
{
    public const HISTORY_DAYS = 365;

    /**
     * Найкраща ціна по днях за рік і мінімум за цей час.
     *
     * @return array{points: list<array{day: string, price: float}>, low: float|null}
     */
    public function history(Game $game): array
    {
        $points = DB::table('game_price_points')->where('game_id', $game->id)
            ->where('day', '>=', now()->subDays(self::HISTORY_DAYS)->toDateString())
            ->orderBy('day')->get(['day', 'price'])
            ->map(fn ($r) => ['day' => (string) $r->day, 'price' => (float) $r->price])->values()->all();

        return ['points' => $points, 'low' => $points === [] ? null : min(array_column($points, 'price'))];
    }

    /**
     * @param  array{store: string, price: float, retail: float, savings: int, url: string}|null  $best
     */
    public function record(Game $game, ?array $best): void
    {
        if ($best === null) {
            return;
        }
        DB::table('game_price_points')->upsert(
            [['game_id' => $game->id, 'day' => now()->toDateString(), 'price' => $best['price'], 'retail' => $best['retail'] ?: null, 'store' => mb_substr($best['store'], 0, 40)]],
            ['game_id', 'day'],
            ['price', 'retail', 'store'],
        );
    }
}
