<?php

namespace App\Console\Commands;

use App\Services\Games\GameCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/** Оновлює каталог мультиплеєрних ігор з усіх налаштованих джерел (IGDB і RAWG); без ключів — лише стартовий список. */
class GamesSync extends Command
{
    protected $signature = 'games:sync {--pages=5 : Скільки сторінок на кожен розділ (IGDB — по 500 ігор, RAWG — по 40)}';

    protected $description = 'Оновити каталог мультиплеєрних ігор';

    public function handle(GameCatalog $catalog): int
    {
        $seeded = $catalog->seed();
        if (! $catalog->configured()) {
            $this->warn("Ключі IGDB / RAWG не налаштовано — лише стартовий список (+{$seeded}). Адмінка → Інтеграції → Каталог ігор.");

            return self::SUCCESS;
        }
        $result = $catalog->sync(max(1, (int) $this->option('pages')));
        Cache::forget('games.genres');
        $this->info("Джерело: {$catalog->source()}. Ігор оновлено: {$result['games']}, посилань перевірено: {$result['links']}, зі стартового списку: +{$seeded}");

        return self::SUCCESS;
    }
}
