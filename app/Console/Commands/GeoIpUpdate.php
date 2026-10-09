<?php

namespace App\Console\Commands;

use App\Services\Geo\GeoIp;
use Illuminate\Console\Command;

class GeoIpUpdate extends Command
{
    protected $signature = 'geoip:update';

    protected $description = 'Завантажує свіжу базу «IP → країна» для блокування країн';

    public function handle(GeoIp $geo): int
    {
        if (! $geo->update()) {
            $this->error('Не вдалося завантажити базу (мережа або ключ MaxMind).');

            return self::FAILURE;
        }
        $this->info('Базу оновлено.');

        return self::SUCCESS;
    }
}
