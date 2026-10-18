<?php

namespace App\Console\Commands;

use App\Services\ScheduledPosts;
use Illuminate\Console\Command;

/** Випускає записи, для яких настав запланований час. */
class PublishScheduledPosts extends Command
{
    protected $signature = 'posts:publish';

    protected $description = 'Опублікувати заплановані записи';

    public function handle(ScheduledPosts $posts): int
    {
        $count = $posts->publishDue();
        if ($count > 0) {
            $this->info("Опубліковано записів: {$count}");
        }

        return self::SUCCESS;
    }
}
