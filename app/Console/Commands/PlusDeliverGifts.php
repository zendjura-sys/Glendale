<?php

namespace App\Console\Commands;

use App\Services\Plus\PlusGifts;
use Illuminate\Console\Command;

/** Вручити відкладені подарунки GameCon+, чий день настав. */
class PlusDeliverGifts extends Command
{
    protected $signature = 'plus:deliver-gifts';

    protected $description = 'Вручити відкладені подарунки GameCon+';

    public function handle(PlusGifts $gifts): int
    {
        $this->info('Вручено: '.$gifts->deliverDue());

        return self::SUCCESS;
    }
}
