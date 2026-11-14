<?php

namespace App\Console\Commands;

use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiClient;
use App\Services\Cards\CardCollection;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/** ІІ розкладає картки без набору за темами (пачками по 30). Набір, заданий вручну, не чіпає. */
class CardsAiThemes extends Command
{
    protected $signature = 'cards:ai-themes {--batches=5}';

    protected $description = 'Розкласти колекційні картки за тематичними наборами за допомогою ІІ';

    public function handle(AiAssistant $ai, CardCollection $cards): int
    {
        if (! app(AiClient::class)->configured()) {
            $this->warn('ІІ не підключено в адмінці — набори не створено.');

            return self::SUCCESS;
        }
        $done = 0;
        for ($b = 0; $b < (int) $this->option('batches'); $b++) {
            $tagged = DB::table('card_themes')->pluck('card_key')->flip();
            $batch = $cards->catalog()->reject(fn ($c) => $tagged->has($c['key']))->take(30)->values();
            if ($batch->isEmpty()) {
                break;
            }
            $result = $ai->cardThemes($batch->map(fn ($c) => [
                'key' => $c['key'], 'name' => $c['name'],
                'about' => $c['kind'] === 'game' ? 'гра, жанр: '.$c['set'] : 'персонаж «'.$c['set'].'»',
            ])->all(), CardCollection::THEMES);
            if ($result === []) {
                break;
            }
            foreach ($result as $key => $theme) {
                DB::table('card_themes')->updateOrInsert(['card_key' => $key], ['theme' => $theme, 'source' => 'ai', 'updated_at' => now(), 'created_at' => now()]);
                $done++;
            }
            Cache::forget('cards.catalog');
        }
        $this->info("Розкладено карток: {$done}");

        return self::SUCCESS;
    }
}
