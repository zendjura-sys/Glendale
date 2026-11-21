<?php

namespace App\Console\Commands;

use App\Models\Livecast;
use App\Models\LivecastIntegration;
use App\Services\LiveCast\DonatelloClient;
use App\Services\LiveCast\DonatikClient;
use App\Services\LiveCast\DonationInbox;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Донати Donatik / Donatello через API для живих LiveCast — на додачу до вебхуків: якщо колбек
 * не налаштовано чи він не дійшов, донат усе одно з’явиться в чаті. Лише донати після початку
 * ефіру; дублікати з вебхуком відсіює DonationInbox::publish().
 */
class LiveCastPollDonations extends Command
{
    protected $signature = 'livecast:poll-donations';

    protected $description = 'Підтягнути донати Donatik / Donatello в чат живих LiveCast';

    public function handle(DonationInbox $inbox): int
    {
        $published = 0;
        $streams = Livecast::query()->with('host')->where('status', Livecast::LIVE)->get();
        foreach ($streams as $stream) {
            $integrations = LivecastIntegration::query()->where('user_id', $stream->host_id)->whereNotNull('api_token')->get();
            foreach ($integrations as $integration) {
                try {
                    $rows = match ($integration->provider) {
                        LivecastIntegration::DONATELLO => (new DonatelloClient((string) $integration->api_token))->donates(0, 20),
                        LivecastIntegration::DONATIK => (new DonatikClient((string) $integration->api_token))->donations(),
                        default => [],
                    };
                } catch (\Throwable $e) {
                    Log::warning('livecast: donation poll failed', ['provider' => $integration->provider, 'user' => $stream->host_id, 'error' => $e->getMessage()]);

                    continue;
                }
                foreach ($rows as $row) {
                    // Без часу — не знаємо, чи це не давній донат: пропускаємо (його принесе вебхук).
                    if ($row['created_at'] === null || $stream->started_at === null) {
                        continue;
                    }
                    try {
                        $at = Carbon::parse($row['created_at']);
                    } catch (\Throwable) {
                        continue;
                    }
                    if ($at->lt($stream->started_at)) {
                        continue;
                    }
                    if ($inbox->publish($stream->host, [...$row, 'provider' => $integration->provider]) !== null) {
                        $published++;
                    }
                }
                $integration->forceFill(['last_synced_at' => now()])->save();
            }
        }
        $this->info("Донатів у чат: {$published}.");

        return self::SUCCESS;
    }
}
