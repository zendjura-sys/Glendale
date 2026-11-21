<?php

namespace App\Console\Commands;

use App\Services\Plus\PlusGifts;
use App\Services\Plus\PlusTrial;
use Illuminate\Console\Command;

/** Вручити відкладені подарунки GameCon+, чий день настав, і нагадати про кінець пробного періоду. */
class PlusDeliverGifts extends Command
{
    protected $signature = 'plus:deliver-gifts';

    protected $description = 'Вручити відкладені подарунки GameCon+';

    public function handle(PlusGifts $gifts, PlusTrial $trial): int
    {
        $this->info('Вручено: '.$gifts->deliverDue());
        $this->info('Нагадано про кінець пробного: '.$trial->remind());

        return self::SUCCESS;
    }
}
