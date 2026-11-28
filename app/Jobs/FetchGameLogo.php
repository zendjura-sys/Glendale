<?php

namespace App\Jobs;

use App\Models\Game;
use App\Services\Games\GameLogoFetcher;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Знайти логотип гри (іконку застосунку) для значка біля ніка — у фоні, раз на гру. */
class FetchGameLogo implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $uniqueFor = 3600;

    public function __construct(public int $gameId) {}

    public function uniqueId(): string
    {
        return (string) $this->gameId;
    }

    public function handle(GameLogoFetcher $fetcher): void
    {
        $game = Game::query()->find($this->gameId);
        if ($game !== null && GameLogoFetcher::due($game)) {
            $fetcher->fetch($game);
        }
    }
}
