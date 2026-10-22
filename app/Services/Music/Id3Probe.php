<?php

namespace App\Services\Music;

use App\Models\Track;
use getID3;
use getid3_lib;
use Throwable;

/**
 * Запасний розбір файлу без ffprobe — бібліотека getID3 (чистий PHP): кодек, частота, розрядність,
 * бітрейт, канали, тривалість, теги й вбудована обкладинка. Повертає той самий формат, що й
 * AudioProbe::probe(), тож обробка треку й значки якості працюють однаково.
 */
class Id3Probe
{
    public function available(): bool
    {
        return class_exists(getID3::class);
    }

    /**
     * @return array{codec: string, sample_rate: int|null, bit_depth: int|null, bitrate: int|null, channels: int|null, duration: int|null, quality: string, has_cover: bool, tags: array{}, raw_tags: array<string, string>}|null
     */
    public function probe(string $file): ?array
    {
        $info = $this->analyze($file);
        $audio = is_array($info['audio'] ?? null) ? $info['audio'] : [];
        $sampleRate = (int) ($audio['sample_rate'] ?? 0) ?: null;
        $codec = $this->codec($info, $audio);
        if ($info === null || $codec === null || $sampleRate === null) {
            return null;
        }

        $lossless = AudioProbe::quality($codec, null, null) !== Track::QUALITY_LOSSY;
        $bits = (int) ($audio['bits_per_sample'] ?? 0);
        $bitDepth = str_starts_with($codec, 'dsd_') ? 1 : ($lossless && $bits > 0 && $bits <= 64 ? $bits : null);
        $bitrate = (float) ($audio['bitrate'] ?? $info['bitrate'] ?? 0);
        $duration = (float) ($info['playtime_seconds'] ?? 0);
        $comments = is_array($info['comments'] ?? null) ? $info['comments'] : [];

        $raw = [];
        foreach ($comments as $key => $values) {
            if ($key !== 'picture' && is_array($values) && is_scalar($values[0] ?? null)) {
                $raw[strtolower((string) $key)] = (string) $values[0];
            }
        }

        return [
            'codec' => substr($codec, 0, 20),
            'sample_rate' => $sampleRate,
            'bit_depth' => $bitDepth,
            'bitrate' => $bitrate > 0 ? (int) round($bitrate / 1000) : null,
            'channels' => (int) ($audio['channels'] ?? 0) ?: null,
            'duration' => $duration >= 0.5 ? (int) round($duration) : null,
            'quality' => AudioProbe::quality($codec, $sampleRate, $bitDepth),
            'has_cover' => $this->picture($comments) !== null,
            'tags' => [],
            'raw_tags' => $raw,
        ];
    }

    /** Вбудована обкладинка у тимчасовий файл (.jpg/.png); шлях або null. Файл видаляє той, хто викликав. */
    public function extractCover(string $file): ?string
    {
        $info = $this->analyze($file);
        $picture = $this->picture(is_array($info['comments'] ?? null) ? $info['comments'] : []);
        if ($picture === null) {
            return null;
        }
        $temp = tempnam(sys_get_temp_dir(), 'cover');
        if ($temp === false) {
            return null;
        }
        $out = $temp.(str_contains($picture['mime'], 'png') ? '.png' : '.jpg');
        @unlink($temp);

        return file_put_contents($out, $picture['data']) > 0 ? $out : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function analyze(string $file): ?array
    {
        if (! $this->available() || ! is_file($file)) {
            return null;
        }

        try {
            $getId3 = new getID3;
            $getId3->option_md5_data = false;
            $info = $getId3->analyze($file);
            getid3_lib::CopyTagsToComments($info);
        } catch (Throwable) {
            return null;
        }

        return is_array($info) && empty($info['error']) ? $info : null;
    }

    /**
     * @param  array<string, mixed>  $comments
     * @return array{data: string, mime: string}|null
     */
    private function picture(array $comments): ?array
    {
        $picture = $comments['picture'][0] ?? null;
        if (! is_array($picture) || ! is_string($picture['data'] ?? null) || $picture['data'] === '') {
            return null;
        }

        return ['data' => $picture['data'], 'mime' => (string) ($picture['image_mime'] ?? 'image/jpeg')];
    }

    /**
     * Назва кодека як у ffprobe (mp3, flac, alac, pcm_s16le…), щоб значки якості рахувалися однаково.
     *
     * @param  array<string, mixed>|null  $info
     * @param  array<string, mixed>  $audio
     */
    private function codec(?array $info, array $audio): ?string
    {
        $format = strtolower((string) ($audio['dataformat'] ?? ''));
        $name = strtolower((string) ($audio['codec'] ?? ''));
        $bits = (int) ($audio['bits_per_sample'] ?? 16) ?: 16;
        $pcm = fn (string $endian) => 'pcm_'.($bits === 8 ? 'u8' : 's'.$bits.$endian);

        return match (true) {
            $info === null || $format === '' => null,
            $format === 'mp4' || $format === 'quicktime' => str_contains($name, 'lossless') || str_contains($name, 'alac') ? 'alac' : 'aac',
            $format === 'wav' => str_contains($name, 'float') ? 'pcm_f32le' : $pcm('le'),
            $format === 'aiff' => $pcm('be'),
            $format === 'asf', $format === 'wma' => str_contains($name, 'lossless') ? 'wmalossless' : 'wmav2',
            $format === 'wavpack' || $format === 'wv' => 'wavpack',
            $format === 'monkey' || $format === 'ape' => 'ape',
            $format === 'dsf' || $format === 'dsdiff' => 'dsd_lsbf',
            in_array($format, ['mp3', 'mp2', 'mp1', 'flac', 'vorbis', 'opus', 'aac', 'tta', 'ac3', 'amr'], true) => $format,
            default => $format,
        };
    }
}
