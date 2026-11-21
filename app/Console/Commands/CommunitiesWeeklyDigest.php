<?php

namespace App\Console\Commands;

use App\Services\CommunityDigest;
use Illuminate\Console\Command;

/** Щопонеділка: дайджест найкращих записів тижня у спільнотах, де адмін його ввімкнув. */
class CommunitiesWeeklyDigest extends Command
{
    protected $signature = 'communities:weekly-digest';

    protected $description = 'Опублікувати тижневі дайджести спільнот';

    public function handle(CommunityDigest $digest): int
    {
        $this->info('Дайджестів: '.$digest->run());

        return self::SUCCESS;
    }
}
