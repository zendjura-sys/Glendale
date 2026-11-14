<?php

namespace App\Jobs;

use App\Models\Moment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/**
 * Власний кліп: обрізати за початком/кінцем (обраними в браузері), стиснути в MP4 до 720p
 * (H.264 + AAC, faststart) і зробити обкладинку, якщо людина її не обрала. Оригінал видаляється.
 */
class ProcessMomentClip implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    public function __construct(public int $momentId, public string $source, public float $start, public float $end) {}

    public function handle(): void
    {
        $moment = Moment::query()->find($this->momentId);
        $disk = Storage::disk('public');
        if ($moment === null || ! $disk->exists($this->source)) {
            return;
        }
        $in = $disk->path($this->source);
        $out = "moments/{$moment->id}-".bin2hex(random_bytes(4)).'.mp4';
        $disk->makeDirectory('moments');
        $length = max(1.0, min(Moment::MAX_CLIP_SECONDS, $this->end - $this->start));

        $process = new Process([
            'ffmpeg', '-y', '-ss', (string) $this->start, '-i', $in, '-t', (string) $length,
            '-vf', 'scale=-2:min(720\,ih)', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', $disk->path($out),
        ]);
        $process->setTimeout(540)->run();

        if (! $process->isSuccessful() || ! $disk->exists($out)) {
            Log::warning('moments: clip failed', ['moment' => $moment->id, 'error' => mb_substr($process->getErrorOutput(), -500)]);
            $moment->update(['status' => 'failed']);
            $disk->delete($this->source);

            return;
        }

        $thumb = $moment->thumbnail;
        if ($thumb === null) {
            $poster = "moments/{$moment->id}-poster.jpg";
            (new Process(['ffmpeg', '-y', '-ss', (string) min(1.0, $length / 2), '-i', $disk->path($out), '-frames:v', '1', '-vf', 'scale=-2:480', $disk->path($poster)]))->setTimeout(60)->run();
            $thumb = $disk->exists($poster) ? $disk->url($poster) : null;
        }

        $moment->update([
            'video_path' => $out,
            'url' => $disk->url($out),
            'duration_ms' => (int) round($length * 1000),
            'thumbnail' => $thumb,
            'status' => 'ready',
        ]);
        $disk->delete($this->source);
    }
}
