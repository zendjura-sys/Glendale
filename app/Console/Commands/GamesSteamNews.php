<?php

namespace App\Console\Commands;

use App\Services\Games\SteamNews;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Новини й патчі зі Steam для ігор, у які зараз грають чи за якими стежать; про свіжий патч — сповіщення. */
class GamesSteamNews extends Command
{
    protected $signature = 'games:steam-news {--limit=40}';

    protected $description = 'Оновити новини й патчі ігор зі Steam і сповістити гравців';

    public function handle(SteamNews $news, Plugins $plugins): int
    {
        if (! $plugins->on('steam_patch_news')) {
            return self::SUCCESS;
        }
        $games = $news->due((int) $this->option('limit'));
        $patches = 0;
        $sent = 0;
        foreach ($games as $game) {
            foreach ($news->refresh($game) as $patch) {
                $patches++;
                $sent += $news->notify($patch);
            }
        }
        $this->info("Ігор: {$games->count()}, нових патчів: {$patches}, сповіщень: {$sent}");

        return self::SUCCESS;
    }
}
