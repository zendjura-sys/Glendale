<?php

namespace App\Console\Commands;

use App\Services\Games\GameCatalog;
use Illuminate\Console\Command;

/** Оновлює каталог мультиплеєрних ігор з RAWG; без ключа — лише стартовий список. */
class GamesSync extends Command
{
    protected $signature = 'games:sync {--pages=5 : Скільки сторінок по 40 ігор на кожен розділ}';

    protected $description = 'Оновити каталог мультиплеєрних ігор';

    public function handle(GameCatalog $catalog): int
    {
        $seeded = $catalog->seed();
        if (! $catalog->configured()) {
            $this->warn("Ключ RAWG не налаштовано — лише стартовий список (+{$seeded}). Адмінка → Інтеграції → Каталог ігор.");

            return self::SUCCESS;
        }
        $result = $catalog->sync(max(1, (int) $this->option('pages')));
        $this->info("Ігор оновлено: {$result['games']}, посилань перевірено: {$result['links']}, зі стартового списку: +{$seeded}");

        return self::SUCCESS;
    }
}
