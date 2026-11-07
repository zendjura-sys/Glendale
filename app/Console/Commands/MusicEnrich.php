<?php

namespace App\Console\Commands;

use App\Jobs\EnrichTrackMetadata;
use App\Models\Track;
use App\Services\Music\MetadataEnricher;
use Illuminate\Console\Command;
use Throwable;

/**
 * Метадані для вже завантажених треків (альбом, рік, жанр, обкладинка, текст) з усіх джерел.
 * Типово — треки, які ще не збагачувались; --all — усі (автоматичне оновиться, якщо знайдеться краще).
 */
class MusicEnrich extends Command
{
    protected $signature = 'music:enrich {--all : Усі треки, а не лише ще не оброблені} {--limit= : Не більше стількох треків} {--queue : Поставити в чергу замість виконання тут}';

    protected $description = 'Оновити метадані треків (AcoustID, MusicBrainz, Discogs, Spotify, Last.fm, Cover Art Archive, LRCLIB)';

    public function handle(MetadataEnricher $enricher): int
    {
        if (! $enricher->online()) {
            $this->warn('Зовнішні запити метаданих вимкнено (MUSIC_METADATA=false).');

            return self::FAILURE;
        }
        $limit = $this->option('limit') !== null ? max(1, (int) $this->option('limit')) : null;

        if ($this->option('queue')) {
            $this->info('У черзі: '.EnrichTrackMetadata::dispatchPending((bool) $this->option('all'), $limit).' треків.');

            return self::SUCCESS;
        }

        $query = Track::query()->when(! $this->option('all'), fn ($q) => $q->whereNull('enriched_at'))->orderBy('id');
        $total = $limit !== null ? min($limit, $query->count()) : $query->count();
        $bar = $this->output->createProgressBar($total);
        $done = 0;
        $query->lazyById(100)->take($total)->each(function (Track $track) use ($enricher, $bar, &$done) {
            try {
                $done += $enricher->enrich($track) !== [] ? 1 : 0;
            } catch (Throwable $e) {
                $this->newLine();
                $this->warn("Трек {$track->id}: {$e->getMessage()}");
            }
            $bar->advance();
        });
        $bar->finish();
        $this->newLine();
        $this->info("Оброблено: {$total}, оновлено: {$done}.");

        return self::SUCCESS;
    }
}
