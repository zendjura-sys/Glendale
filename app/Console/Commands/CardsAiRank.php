<?php

namespace App\Console\Commands;

use App\Models\CardCharacter;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/** ІІ ставить ранг персонажам без рангу (пачками по 20). Ранг, заданий персоналом вручну, не чіпає. */
class CardsAiRank extends Command
{
    protected $signature = 'cards:ai-rank {--batches=5}';

    protected $description = 'Оцінити ранги персонажів колекційних карток за допомогою ІІ';

    public function handle(AiAssistant $ai): int
    {
        if (! app(AiClient::class)->configured()) {
            $this->warn('ІІ не підключено в адмінці — ранги рахуються за популярністю.');

            return self::SUCCESS;
        }
        $done = 0;
        for ($b = 0; $b < (int) $this->option('batches'); $b++) {
            $batch = CardCharacter::query()->with('movie:id,title')->whereNull('ai_rank')->whereNull('manual_rank')->orderBy('id')->limit(20)->get();
            if ($batch->isEmpty()) {
                break;
            }
            $ranks = $ai->cardRanks($batch->map(fn (CardCharacter $c) => ['id' => $c->id, 'name' => $c->name, 'title' => (string) $c->movie?->title, 'role' => $c->role])->all());
            if ($ranks === []) {
                break;
            }
            foreach ($batch as $c) {
                if (isset($ranks[$c->id])) {
                    $c->update(['ai_rank' => $ranks[$c->id]['rank'], 'ai_reason' => $ranks[$c->id]['reason']]);
                    $done++;
                }
            }
        }
        Cache::forget('cards.catalog');
        $this->info("Оцінено персонажів: {$done}");

        return self::SUCCESS;
    }
}
