<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $sticker_pack_id
 * @property string $path
 * @property string|null $emoji
 * @property int $position
 * @property-read string $url
 */
#[Fillable(['path', 'emoji', 'position'])]
class Sticker extends Model
{
    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(StickerPack::CACHE_KEY));
        static::deleted(fn () => Cache::forget(StickerPack::CACHE_KEY));
    }

    /**
     * @return BelongsTo<StickerPack, $this>
     */
    public function pack(): BelongsTo
    {
        return $this->belongsTo(StickerPack::class, 'sticker_pack_id');
    }

    /**
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }

    /**
     * @return array{id: int, url: string, emoji: string|null}
     */
    public function toCard(): array
    {
        return ['id' => $this->id, 'url' => $this->url, 'emoji' => $this->emoji];
    }
}
