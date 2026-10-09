<?php

namespace App\Console\Commands;

use App\Services\Presence\DiscordGateway;
use App\Services\Presence\DiscordPresence;
use Illuminate\Console\Command;
use Throwable;

/**
 * Бот GameCon слухає Discord Rich Presence і ставить статус «Граю в…».
 * Планувальник запускає команду щохвилини; поки вона працює, нова не стартує (withoutOverlapping).
 */
class DiscordPresenceListen extends Command
{
    protected $signature = 'discord:presence {--minutes=55 : Скільки хвилин слухати до перезапуску}';

    protected $description = 'Статус «Граю в…» з Discord Rich Presence';

    public function handle(DiscordPresence $presence, DiscordGateway $gateway): int
    {
        if (! $presence->configured()) {
            return self::SUCCESS;
        }
        try {
            $handled = $gateway->run(max(1, (int) $this->option('minutes')) * 60, fn (string $line) => $this->info($line));
            $this->info("Оброблено подій присутності: {$handled}");
        } catch (Throwable $e) {
            // Розрив чи перепідключення — штатна ситуація: наступний запуск планувальника під’єднається знову.
            $this->warn($e->getMessage());
        }

        return self::SUCCESS;
    }
}
