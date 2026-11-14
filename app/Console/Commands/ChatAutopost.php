<?php

namespace App\Console\Commands;

use App\Services\Chat\ChatBots;
use Illuminate\Console\Command;

/** Автопости ботів у групах і каналах: надсилає ті, час яких настав. */
class ChatAutopost extends Command
{
    protected $signature = 'chat:autopost';

    protected $description = 'Надіслати автопости ботів бесід, час яких настав';

    public function handle(ChatBots $bots): int
    {
        $sent = $bots->runDue();
        if ($sent > 0) {
            $this->info("Надіслано автопостів: {$sent}");
        }

        return self::SUCCESS;
    }
}
