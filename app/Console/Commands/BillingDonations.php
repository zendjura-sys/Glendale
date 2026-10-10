<?php

namespace App\Console\Commands;

use App\Services\Billing\Donatello;
use App\Services\Billing\TopUps;
use Illuminate\Console\Command;

/** Нові донати Donatello → поповнення рахунків за кодом у повідомленні. */
class BillingDonations extends Command
{
    protected $signature = 'billing:donations';

    protected $description = 'Забрати донати Donatello й зарахувати поповнення';

    public function handle(Donatello $donatello, TopUps $topups): int
    {
        if (! $donatello->configured()) {
            return self::SUCCESS;
        }
        $matched = $topups->syncDonatello();
        if ($matched > 0) {
            $this->info("Зараховано поповнень: {$matched}");
        }

        return self::SUCCESS;
    }
}
