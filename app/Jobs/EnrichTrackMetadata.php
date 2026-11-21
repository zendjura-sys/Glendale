<?php

namespace App\Jobs;

use App\Models\Track;
use App\Services\Music\MetadataEnricher;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Метадані треку з усіх джерел (MetadataEnricher): після обробки файлу й для «Оновити метадані»
 * в адмінці / music:enrich. Збій нічого не ламає — трек лишається як був.
 */
class EnrichTrackMetadata implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    // Менше за retry_after черги (90 с); MusicBrainz — 1 запит/с, тож трек укладається з запасом.
    public int $timeout = 85;

    public int $tries = 1;

    public int $uniqueFor = 900;

    public function __construct(public readonly int $trackId) {}

    /**
     * Ставить у чергу збагачення треків, які ще не збагачувались (або всіх — $all), порціями.
     * Повертає кількість поставлених задач.
     */
    public static function dispatchPending(bool $all = false, ?int $limit = null): int
    {
        $count = 0;
        // Без $all — нові треки, а також треки без тривалості («0:00»).
        Track::query()->when(! $all, fn ($q) => $q->where(fn ($q) => $q->whereNull('enriched_at')->orWhere('duration', '<=', 0)))->select('id')
            ->chunkById(200, function ($tracks) use (&$count, $limit) {
                foreach ($tracks as $track) {
                    if ($limit !== null && $count >= $limit) {
                        return false;
                    }
                    self::dispatch($track->id);
                    $count++;
                }

                return true;
            });

        return $count;
    }

    public function uniqueId(): string
    {
        return (string) $this->trackId;
    }

    public function handle(MetadataEnricher $enricher): void
    {
        $track = Track::query()->find($this->trackId);
        if ($track === null) {
            return;
        }

        try {
            $enricher->enrich($track);
        } catch (Throwable $e) {
            Log::warning('Метадані треку не оновлено', ['track' => $this->trackId, 'error' => $e->getMessage()]);
        }
    }
}
