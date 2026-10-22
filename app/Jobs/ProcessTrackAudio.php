<?php

namespace App\Jobs;

use App\Models\Track;
use App\Services\Music\AudioProbe;
use App\Services\MusicService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Обробка завантаженого треку через ffmpeg: кодек і якість (Lossless / Hi-Res), теги й вбудована
 * обкладинка — лише в порожні поля (введене користувачем не перезаписуємо), а для форматів, які
 * браузер не відтворює (ALAC, AIFF, WMA, APE…), — копія AAC 256 кбіт/с у stream_path.
 * Оригінал завжди лишається (його віддає «Завантажити»).
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

    public function handle(AudioProbe $probe, MusicService $music): void
    {
        $track = Track::query()->find($this->trackId);
        if ($track === null) {
            return;
        }

        try {
            $this->process($track, $probe, $music);
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

    private function process(Track $track, AudioProbe $probe, MusicService $music): void
    {
        $disk = Storage::disk('public');
        $file = $disk->path($track->path);
        $info = $probe->probe($file);
        if ($info === null) {
            return;
        }

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
        // Теги з файлу — лише туди, де користувач нічого не вказав.
        $limits = ['title' => 150, 'artist' => 150, 'album' => 150, 'genre' => 40];
        foreach ($info['tags'] as $field => $value) {
            if (blank($track->getAttribute($field))) {
                $track->setAttribute($field, is_string($value) ? Str::limit($value, $limits[$field] ?? 150, '') : $value);
            }
        }
        $track->saveQuietly();

        if ($track->cover_path === null && $info['has_cover']) {
            $this->saveCover($track, $file, $probe, $music);
        }

        $extension = strtolower(pathinfo($track->path, PATHINFO_EXTENSION));
        if ($track->stream_path !== null || ! $probe->needsStream($extension, $info['codec'])) {
            return;
        }

        // Поки перекодовується — трек у списках не показується.
        $track->forceFill(['processing' => true])->saveQuietly();
        $stream = preg_replace('/\.[^.\/]+$/', '', $track->path).'.stream.m4a';
        if ($probe->transcode($file, $disk->path($stream), $info['sample_rate'])) {
            $track->forceFill(['stream_path' => $stream, 'processing' => false])->saveQuietly();
        } else {
            Log::warning('Не вдалося перекодувати трек для браузера', ['track' => $track->id, 'codec' => $info['codec']]);
        }
    }

    private function saveCover(Track $track, string $file, AudioProbe $probe, MusicService $music): void
    {
        $temp = $probe->extractCover($file);
        if ($temp === null) {
            return;
        }

        try {
            $cover = $music->storeCover(new UploadedFile($temp, 'cover.jpg', 'image/jpeg', null, true));
            $track->forceFill(['cover_path' => $cover])->saveQuietly();
        } catch (Throwable $e) {
            Log::info('Вбудовану обкладинку треку не збережено', ['track' => $track->id, 'error' => $e->getMessage()]);
        } finally {
            @unlink($temp);
        }
    }
}
