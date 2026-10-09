<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use RuntimeException;

class ImageStorage
{
    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver);
    }

    /**
     * Зберігає зображення у WebP, зменшуючи до $maxSide; GIF лишається як є, щоб не втратити анімацію.
     *
     * @param  array{0: int, 1: int}|null  $cover
     * @return array{path: string, mime: string, width: int, height: int, size: int}
     */
    public function store(UploadedFile $file, string $directory, int $maxSide = 2560, ?array $cover = null): array
    {
        $directory = trim($directory, '/').'/'.now()->format('Y/m');
        $disk = Storage::disk('public');

        if ($file->getMimeType() === 'image/gif' && $cover === null) {
            $info = getimagesize($file->getRealPath()) ?: [0, 0];
            $path = $file->storeAs($directory, Str::random(32).'.gif', 'public');
            if ($path === false) {
                throw new RuntimeException('Не вдалося зберегти зображення.');
            }
            $size = $file->getSize();
            if ($size === false) {
                throw new RuntimeException('Не вдалося визначити розмір зображення.');
            }

            return ['path' => $path, 'mime' => 'image/gif', 'width' => $info[0], 'height' => $info[1], 'size' => $size];
        }

        $image = $this->manager->read($file->getRealPath());

        if ($cover !== null) {
            $image->cover($cover[0], $cover[1]);
        } else {
            $image->scaleDown($maxSide, $maxSide);
        }

        $encoded = $image->toWebp(quality: 84);
        $path = $directory.'/'.Str::random(32).'.webp';
        $disk->put($path, (string) $encoded);

        return [
            'path' => $path,
            'mime' => 'image/webp',
            'width' => $image->width(),
            'height' => $image->height(),
            'size' => strlen((string) $encoded),
        ];
    }

    public function delete(?string $path): void
    {
        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }
}
