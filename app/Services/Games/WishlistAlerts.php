<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\GameWishlist;
use App\Notifications\GameDealNotice;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;

/**
 * Знижки на ігри зі списку бажаного (раз на 6 год) і вихід ігор (щодня): найкраща ціна CheapShark нижча за звичайну
 * (або дійшла до бажаної ціни людини) — сповіщаємо один раз; нове сповіщення — лише коли ціна впала ще.
 */
class WishlistAlerts
{
    public function __construct(private readonly CheapShark $prices) {}

    /** @return array{games: int, notified: int} */
    public function run(): array
    {
        $gameIds = GameWishlist::query()->distinct()->pluck('game_id');
        $notified = 0;
        foreach (Game::query()->whereIn('id', $gameIds)->get() as $game) {
            $appId = $game->steamAppId() !== null ? (int) $game->steamAppId() : null;
            if ($appId === null) {
                continue;
            }
            $best = $this->prices->best($appId);
            Sleep::for(300)->milliseconds();
            foreach (GameWishlist::query()->with('user')->where('game_id', $game->id)->get() as $wish) {
                $notified += $this->check($wish, $game, $best) ? 1 : 0;
            }
        }
        Log::info('games: wishlist alerts', ['games' => $gameIds->count(), 'notified' => $notified]);

        return ['games' => $gameIds->count(), 'notified' => $notified];
    }

    /**
     * @param  array{store: string, price: float, retail: float, savings: int, url: string}|null  $best
     */
    public function check(GameWishlist $wish, Game $game, ?array $best): bool
    {
        $target = $wish->target_price !== null ? (float) $wish->target_price : null;
        $hit = $best !== null && ($target !== null ? $best['price'] <= $target : $best['savings'] >= 10);
        if (! $hit) {
            // Знижка скінчилась — наступна знову прийде сповіщенням.
            if ($wish->notified_price !== null) {
                $wish->update(['notified_price' => null]);
            }

            return false;
        }
        if ($wish->notified_price !== null && $best['price'] >= (float) $wish->notified_price - 0.009) {
            return false;
        }
        $price = '$'.number_format($best['price'], 2);
        $text = $best['savings'] > 0
            ? 'Знижка −'.$best['savings'].'% на '.$game->name.': '.$price.' у '.$best['store']
            : $game->name.' за '.$price.' у '.$best['store'];
        $wish->user->notify(new GameDealNotice('price_drop', $text, 'Гра з вашого списку бажаного', '/games/'.$game->slug));
        $wish->update(['notified_price' => $best['price'], 'notified_at' => now()]);

        return true;
    }

    /**
     * Вихід гри зі списку бажаного: сповіщення в день релізу (або протягом двох днів після — якщо пропустили запуск).
     */
    public function releases(): int
    {
        $today = now('Europe/Kyiv')->startOfDay();
        $sent = 0;
        GameWishlist::query()->with(['user', 'game'])
            ->whereNull('release_notified_at')
            ->whereHas('game', fn ($q) => $q->whereDate('released', '>=', $today->copy()->subDays(2)->toDateString())->whereDate('released', '<=', $today->toDateString()))
            ->chunkById(200, function ($wishes) use (&$sent) {
                foreach ($wishes as $wish) {
                    $wish->user->notify(new GameDealNotice('game_release', 'Вийшла '.$wish->game->name.' — гра з вашого списку бажаного', 'Вже можна грати', '/games/'.$wish->game->slug));
                    $wish->update(['release_notified_at' => now()]);
                    $sent++;
                }
            });
        Log::info('games: release alerts', ['notified' => $sent]);

        return $sent;
    }
}
