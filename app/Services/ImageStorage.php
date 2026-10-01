<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

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
     * @return array{path: string, mime: string, width: int, height: int, size: int}
     */
    public function store(UploadedFile $file, string $directory, int $maxSide = 2560, ?array $cover = null): array
    {
        $directory = trim($directory, '/').'/'.now()->format('Y/m');
        $disk = Storage::disk('public');

        if ($file->getMimeType() === 'image/gif' && $cover === null) {
            [$width, $height] = getimagesize($file->getRealPath()) ?: [0, 0];
            $path = $file->storeAs($directory, Str::random(32).'.gif', 'public');

            return ['path' => $path, 'mime' => 'image/gif', 'width' => $width, 'height' => $height, 'size' => $file->getSize()];
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
