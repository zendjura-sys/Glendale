<?php

namespace App\Console\Commands;

use App\Services\Voice\Calls;
use Illuminate\Console\Command;

/** Дзвінки без відповіді стають пропущеними (особисті) або перестають дзвонити (групові). */
class CallsExpire extends Command
{
    protected $signature = 'calls:expire';

    protected $description = 'Завершити дзвінки, на які не відповіли';

    public function handle(Calls $calls): int
    {
        $count = $calls->expire();
        if ($count > 0) {
            $this->info("Оброблено дзвінків: {$count}");
        }

        return self::SUCCESS;
    }
}
