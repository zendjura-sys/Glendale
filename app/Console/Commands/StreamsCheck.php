<?php

namespace App\Console\Commands;

use App\Services\Streams\LiveStreams;
use Illuminate\Console\Command;

/** Хто з гравців зараз в ефірі на Twitch чи YouTube. */
class StreamsCheck extends Command
{
    protected $signature = 'streams:check';

    protected $description = 'Перевірити, хто зараз стрімить';

    public function handle(LiveStreams $streams): int
    {
        $result = $streams->check();
        $this->info("Twitch: {$result['twitch']}, YouTube: {$result['youtube']}, в ефірі: {$result['live']}");

        return self::SUCCESS;
    }
}
