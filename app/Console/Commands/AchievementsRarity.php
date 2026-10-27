<?php

namespace App\Console\Commands;

use App\Services\Achievements;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Щоночі: у скількох активних людей є кожен бейдж. */
class AchievementsRarity extends Command
{
    protected $signature = 'achievements:rarity';

    protected $description = 'Перерахувати рідкість бейджів';

    public function handle(Achievements $achievements, Plugins $plugins): int
    {
        if (! $plugins->on('badge_rarity')) {
            return self::SUCCESS;
        }
        $total = $achievements->recountRarity();
        $this->info("Перераховано за {$total} людьми.");

        return self::SUCCESS;
    }
}
