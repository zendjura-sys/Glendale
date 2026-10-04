<?php

namespace App\Console\Commands;

use App\Services\Families\PersonalBankDigest;
use Illuminate\Console\Command;

/** Особиста тижнева зведення рахунку в банку сім’ї — листом кожному учаснику. */
class FamiliesBankDigest extends Command
{
    protected $signature = 'families:bank-digest';

    protected $description = 'Надіслати учасникам сімей зведення особистого рахунку за тиждень';

    public function handle(PersonalBankDigest $digest): int
    {
        $this->info('Листів у черзі: '.$digest->sendAll());

        return self::SUCCESS;
    }
}
