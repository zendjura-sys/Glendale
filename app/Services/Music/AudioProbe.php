<?php

namespace App\Services\Music;

use App\Models\Track;
use Illuminate\Container\Attributes\Singleton;
use Illuminate\Support\Facades\Process;
use Throwable;

/**
 * Звукові дані файлу через ffprobe/ffmpeg: кодек, частота, розрядність, теги, вбудована обкладинка,
 * а також копія AAC для браузера, якщо оригінал грає не скрізь. Немає ffmpeg на сервері —
 * методи повертають null, і завантаження працює як раніше (лише «рідні» формати).
 */
#[Singleton]
class AudioProbe
{
    /** Кодеки без втрат: для них значок Lossless / Hi-Res Lossless. */
    public const LOSSLESS_CODECS = ['flac', 'alac', 'ape', 'wavpack', 'tta', 'wmalossless', 'mlp', 'truehd', 'tak', 'shorten'];

    /** Кодеки, які відтворюють усі браузери (у «рідних» контейнерах з Track::AUDIO_MIMES). */
    public const PLAYABLE_CODECS = ['mp3', 'aac', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_u8', 'pcm_f32le'];

    /** Розширення, у яких браузер може відтворити оригінал (якщо кодек підходить). */
    public const PLAYABLE_EXTENSIONS = ['mp3', 'mpga', 'm4a', 'mp4', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'webm'];

    /** @var array<string, string|false> знайдені шляхи до програм (на час процесу) */
    private array $binaries = [];

    public function available(): bool
    {
        return $this->binary('ffprobe') !== null && $this->binary('ffmpeg') !== null;
    }

    /**
     * @return array{codec: string, sample_rate: int|null, bit_depth: int|null, bitrate: int|null, channels: int|null, duration: int|null, quality: string, has_cover: bool, tags: array{title?: string, artist?: string, album?: string, genre?: string, year?: int, track_no?: int}}|null
     */
    public function probe(string $file): ?array
    {
        $ffprobe = $this->binary('ffprobe');
        if ($ffprobe === null || ! is_file($file)) {
            return null;
        }

        try {
            $result = Process::timeout(60)->run([$ffprobe, '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', $file]);
        } catch (Throwable) {
            return null;
        }
        $data = $result->successful() ? json_decode($result->output(), true) : null;
        if (! is_array($data)) {
            return null;
        }

        $streams = is_array($data['streams'] ?? null) ? $data['streams'] : [];
        $audio = collect($streams)->first(fn ($s) => is_array($s) && ($s['codec_type'] ?? null) === 'audio');
        if (! is_array($audio)) {
            return null;
        }
        $format = is_array($data['format'] ?? null) ? $data['format'] : [];

        $codec = strtolower((string) ($audio['codec_name'] ?? ''));
        $sampleRate = (int) ($audio['sample_rate'] ?? 0) ?: null;
        $bitDepth = $this->bitDepth($audio, $codec);
        $bitrate = (int) ($audio['bit_rate'] ?? $format['bit_rate'] ?? 0);
        $duration = (float) ($audio['duration'] ?? $format['duration'] ?? 0);
        $hasCover = collect($streams)->contains(fn ($s) => is_array($s) && ($s['codec_type'] ?? null) === 'video'
            && (($s['disposition']['attached_pic'] ?? 0) == 1 || in_array($s['codec_name'] ?? '', ['mjpeg', 'png'], true)));

        return [
            'codec' => substr($codec, 0, 20),
            'sample_rate' => $sampleRate,
            'bit_depth' => $bitDepth,
            'bitrate' => $bitrate > 0 ? (int) round($bitrate / 1000) : null,
            'channels' => (int) ($audio['channels'] ?? 0) ?: null,
            'duration' => $duration > 0 ? (int) round($duration) : null,
            'quality' => self::quality($codec, $sampleRate, $bitDepth),
            'has_cover' => $hasCover,
            'tags' => $this->tags(array_change_key_case([
                ...(is_array($audio['tags'] ?? null) ? $audio['tags'] : []),
                ...(is_array($format['tags'] ?? null) ? $format['tags'] : []),
            ])),
        ];
    }

    /** Якість: без втрат до 48 кГц / 24 біт — lossless, вище — hires; решта — стиснений звук. */
    public static function quality(string $codec, ?int $sampleRate, ?int $bitDepth): string
    {
        $lossless = in_array($codec, self::LOSSLESS_CODECS, true) || str_starts_with($codec, 'pcm_') || str_starts_with($codec, 'dsd_');
        if (! $lossless) {
            return Track::QUALITY_LOSSY;
        }

        return ($sampleRate ?? 0) > 48000 || ($bitDepth ?? 0) > 24 ? Track::QUALITY_HIRES : Track::QUALITY_LOSSLESS;
    }

    /** Чи потрібна копія для браузера: незвичний контейнер (AIFF, WMA, APE…) або кодек (ALAC у m4a, AC-3 у mp4). */
    public function needsStream(string $extension, string $codec): bool
    {
        return ! in_array(strtolower($extension), self::PLAYABLE_EXTENSIONS, true) || ! in_array($codec, self::PLAYABLE_CODECS, true);
    }

    /** Вбудована обкладинка у тимчасовий JPEG; шлях або null. Файл видаляє той, хто викликав. */
    public function extractCover(string $file): ?string
    {
        $ffmpeg = $this->binary('ffmpeg');
        $temp = $ffmpeg !== null ? tempnam(sys_get_temp_dir(), 'cover') : false;
        if ($temp === false) {
            return null;
        }
        $out = $temp.'.jpg';
        @unlink($temp);

        try {
            $result = Process::timeout(60)->run([$ffmpeg, '-y', '-v', 'error', '-i', $file, '-an', '-map', '0:v:0', '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '2', $out]);
        } catch (Throwable) {
            $result = null;
        }
        if ($result?->successful() && is_file($out) && filesize($out) > 0) {
            return $out;
        }
        @unlink($out);

        return null;
    }

    /** Перекодування в AAC 256 кбіт/с (.m4a) для відтворення в будь-якому браузері (до 75 с — менше за retry_after черги). */
    public function transcode(string $file, string $target, ?int $sampleRate = null): bool
    {
        $ffmpeg = $this->binary('ffmpeg');
        if ($ffmpeg === null) {
            return false;
        }
        // AAC у браузерах — до 48 кГц; Hi-Res і DSD знижуємо (оригінал лишається для завантаження).
        $rate = ($sampleRate ?? 0) > 48000 || ($sampleRate ?? 0) === 0 ? ['-ar', '48000'] : [];

        try {
            $result = Process::timeout(75)->run([$ffmpeg, '-y', '-v', 'error', '-i', $file, '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '256k', ...$rate, '-movflags', '+faststart', '-f', 'mp4', $target]);
        } catch (Throwable) {
            return false;
        }

        return $result->successful() && is_file($target) && filesize($target) > 0;
    }

    /**
     * @param  array<string, mixed>  $audio
     */
    private function bitDepth(array $audio, string $codec): ?int
    {
        if (str_starts_with($codec, 'dsd_')) {
            return 1;
        }
        if (self::quality($codec, null, null) === Track::QUALITY_LOSSY) {
            return null;
        }
        $bits = (int) ($audio['bits_per_raw_sample'] ?? 0) ?: (int) ($audio['bits_per_sample'] ?? 0);

        return $bits > 0 && $bits <= 64 ? $bits : null;
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array{title?: string, artist?: string, album?: string, genre?: string, year?: int, track_no?: int}
     */
    private function tags(array $raw): array
    {
        $text = fn (string ...$keys) => collect($keys)->map(fn ($k) => trim((string) ($raw[$k] ?? '')))->first(fn ($v) => $v !== '');
        $tags = array_filter([
            'title' => $text('title'),
            'artist' => $text('artist', 'album_artist', 'albumartist'),
            'album' => $text('album'),
            'genre' => $text('genre'),
        ]);

        // Рік — перші чотири цифри дати (2021-05-04 → 2021), номер — до скісної (3/12 → 3).
        if (preg_match('/\b(1[89]\d\d|2\d\d\d)\b/', (string) $text('date', 'year', 'originaldate'), $m)) {
            $tags['year'] = (int) $m[1];
        }
        $trackNo = (int) explode('/', (string) $text('track', 'tracknumber'))[0];
        if ($trackNo > 0 && $trackNo < 1000) {
            $tags['track_no'] = $trackNo;
        }

        return $tags;
    }

    /** Шлях до ffprobe/ffmpeg: з config/services.php (FFPROBE_PATH, FFMPEG_PATH) або знайдений у PATH. */
    private function binary(string $name): ?string
    {
        if (! array_key_exists($name, $this->binaries)) {
            $configured = (string) config('services.ffmpeg.'.$name, $name);
            if (str_contains($configured, '/')) {
                $this->binaries[$name] = is_executable($configured) ? $configured : false;
            } else {
                // Шукаємо в PATH без запуску оболонки (дешево — викликається на кожну сторінку);
                // у PHP-FPM PATH буває порожнім, тому додаємо звичні теки.
                $dirs = array_unique([...explode(':', (string) getenv('PATH')), '/usr/local/bin', '/usr/bin', '/bin']);
                $found = collect($dirs)->filter()->map(fn ($dir) => rtrim($dir, '/').'/'.$configured)->first(fn ($path) => @is_executable($path));
                $this->binaries[$name] = $found ?? false;
            }
        }

        return $this->binaries[$name] ?: null;
    }
}
