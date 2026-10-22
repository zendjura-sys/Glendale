<?php

namespace App\Jobs;

use App\Models\Track;
use App\Services\Music\AudioProbe;
use App\Services\Music\MetadataEnricher;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Обробка завантаженого треку: кодек і якість (Lossless / Hi-Res) через ffprobe або getID3, теги й
 * вбудована обкладинка — лише в порожні поля (введене користувачем не перезаписуємо), а для форматів,
 * які браузер не відтворює (ALAC, AIFF, WMA, APE…), — копія AAC 256 кбіт/с у stream_path (потрібен ffmpeg).
 * Оригінал завжди лишається (його віддає «Завантажити»). Далі — EnrichTrackMetadata (зовнішні каталоги).
 */
class ProcessTrackAudio implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    // Менше за retry_after черги (90 с), інакше воркер узяв би задачу вдруге.
    public int $timeout = 85;

    public int $tries = 1;

    public int $uniqueFor = 600;

    public function __construct(public readonly int $trackId) {}

    public function uniqueId(): string
    {
        return (string) $this->trackId;
    }

    public function handle(AudioProbe $probe, MetadataEnricher $enricher): void
    {
        $track = Track::query()->find($this->trackId);
        if ($track === null) {
            return;
        }

        try {
            $this->process($track, $probe, $enricher);
        } finally {
            // Що б не сталося, трек не лишається схованим: у гіршому разі грає оригінал.
            if ($track->processing) {
                $track->forceFill(['processing' => false])->saveQuietly();
            }
        }
    }

    public function failed(?Throwable $e): void
    {
        Track::query()->whereKey($this->trackId)->update(['processing' => false]);
    }

    private function process(Track $track, AudioProbe $probe, MetadataEnricher $enricher): void
    {
        $disk = Storage::disk('public');
        $file = $disk->path($track->path);
        $info = $probe->probe($file);

        if ($info !== null) {
            $track->forceFill([
                'codec' => $info['codec'],
                'sample_rate' => $info['sample_rate'],
                'bit_depth' => $info['bit_depth'],
                'bitrate' => $info['bitrate'],
                'channels' => $info['channels'],
                'quality' => $info['quality'],
            ]);
            if ($track->duration <= 0 && $info['duration'] !== null) {
                $track->duration = min($info['duration'], 65535);
            }
            $track->saveQuietly();

            // Теги й вбудована обкладинка — лише туди, де користувач нічого не вказав (довіра «теги файлу»).
            try {
                $enricher->applyFile($track, $info, $file);
            } catch (Throwable $e) {
                Log::info('Теги треку не застосовано', ['track' => $track->id, 'error' => $e->getMessage()]);
            }

            $this->stream($track, $file, $info, $probe);
        }

        // Альбом, рік, жанр, обкладинка й текст із зовнішніх каталогів — окремою задачею (мережа повільна).
        if ($enricher->online()) {
            EnrichTrackMetadata::dispatch($track->id);
        }
    }

    /**
     * Копія AAC для форматів, які браузер не відтворює; без ffmpeg — пропускаємо (грає оригінал).
     *
     * @param  array{codec: string, sample_rate: int|null}  $info
     */
    private function stream(Track $track, string $file, array $info, AudioProbe $probe): void
    {
        $extension = strtolower(pathinfo($track->path, PATHINFO_EXTENSION));
        if ($track->stream_path !== null || ! $probe->available() || ! $probe->needsStream($extension, $info['codec'])) {
            return;
        }

        // Поки перекодовується — трек у списках не показується.
        $track->forceFill(['processing' => true])->saveQuietly();
        $stream = preg_replace('/\.[^.\/]+$/', '', $track->path).'.stream.m4a';
        if ($probe->transcode($file, Storage::disk('public')->path($stream), $info['sample_rate'])) {
            $track->forceFill(['stream_path' => $stream, 'processing' => false])->saveQuietly();
        } else {
            Log::warning('Не вдалося перекодувати трек для браузера', ['track' => $track->id, 'codec' => $info['codec']]);
        }
    }
}
