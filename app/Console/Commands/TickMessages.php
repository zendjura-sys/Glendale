<?php

namespace App\Console\Commands;

use App\Services\Messenger;
use Illuminate\Console\Command;

/** Випускає відкладені повідомлення і прибирає ті, що мали зникнути. */
class TickMessages extends Command
{
    protected $signature = 'messages:tick';

    protected $description = 'Опублікувати відкладені повідомлення і видалити прострочені';

    public function handle(Messenger $messenger): int
    {
        $published = $messenger->publishDue();
        $expired = $messenger->expireDue();
        if ($published > 0) {
            $this->info("Опубліковано повідомлень: {$published}");
        }
        if ($expired > 0) {
            $this->info("Зникло повідомлень: {$expired}");
        }

        return self::SUCCESS;
    }
}
