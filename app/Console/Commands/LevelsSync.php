<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Profile\ProfileLevel;
use Illuminate\Console\Command;

/** Раз на годину: нові рівні тих, хто був на сайті останню добу (сповіщення й нагороди). */
class LevelsSync extends Command
{
    protected $signature = 'levels:sync';

    protected $description = 'Звірити рівні профілю активних людей: сповіщення про новий рівень і нагороди за віхи';

    public function handle(ProfileLevel $levels): int
    {
        $n = 0;
        User::query()->whereNull('banned_at')->where('last_seen_at', '>=', now()->subDay())
            ->orderBy('id')->chunkById(200, function ($users) use ($levels, &$n) {
                foreach ($users as $user) {
                    $levels->sync($user);
                    $n++;
                }
            });
        $this->info("Перевірено: {$n}");

        return self::SUCCESS;
    }
}
