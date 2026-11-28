<?php

namespace App\Console\Commands;

use App\Services\Cards\CardAutopilot;
use Illuminate\Console\Command;

/** Щопівгодини: автопілот колекційних карток (працює, лише коли на сайті тихо). */
class CardsAutopilot extends Command
{
    protected $signature = 'cards:autopilot {--force : Запустити зараз, навіть якщо на сайті людно}';

    protected $description = 'Підтягнути персонажів, ранги й набори колекційних карток у тихі години';

    public function handle(CardAutopilot $autopilot): int
    {
        $result = $autopilot->run((bool) $this->option('force'));
        $this->info(json_encode($result, JSON_UNESCAPED_UNICODE) ?: '');

        return self::SUCCESS;
    }
}
