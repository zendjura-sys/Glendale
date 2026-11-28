<?php

namespace App\Support;

use Closure;
use Illuminate\Http\UploadedFile;

/**
 * Файли стікерів: PNG, WebP і GIF (зокрема анімовані) та відеостікери WebM — короткі, без звуку,
 * з циклом. Розмір кадру картинок обмежено; WebM обмежено лише вагою файлу.
 */
final class StickerFiles
{
    public const MIMES = 'png,webp,gif,webm';

    public const ACCEPT = 'image/png,image/webp,image/gif,video/webm';

    /**
     * @return list<mixed>
     */
    public static function rules(int $maxKb, int $maxPx): array
    {
        return [
            'file',
            'mimetypes:image/png,image/webp,image/gif,video/webm,audio/webm',
            'max:'.$maxKb,
            function (string $attribute, mixed $file, Closure $fail) use ($maxPx): void {
                if (! $file instanceof UploadedFile || self::extension($file) === 'webm') {
                    return;
                }
                $size = @getimagesize($file->getRealPath());
                if ($size === false) {
                    $fail('Файл не схожий на зображення.');
                } elseif ($size[0] > $maxPx || $size[1] > $maxPx) {
                    $fail("Стікер має бути не більше {$maxPx}×{$maxPx} px.");
                }
            },
        ];
    }

    public static function extension(UploadedFile $file): string
    {
        return match ($file->getMimeType()) {
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'video/webm', 'audio/webm' => 'webm',
            default => 'png',
        };
    }

    /** Відеостікер (WebM) — показуємо як беззвучне відео з циклом. */
    public static function isVideo(string $path): bool
    {
        return str_ends_with(strtolower($path), '.webm');
    }
}
