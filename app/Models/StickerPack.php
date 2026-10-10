<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string|null $author
 * @property bool $is_active
 * @property bool $is_plus Лише для GameCon+
 * @property int $position
 */
#[Fillable(['slug', 'name', 'author', 'is_active', 'is_plus', 'position'])]
class StickerPack extends Model
{
    public const CACHE_KEY = 'messenger.sticker_packs';

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_plus' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }

    /**
     * @return HasMany<Sticker, $this>
     */
    public function stickers(): HasMany
    {
        return $this->hasMany(Sticker::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @param  Builder<StickerPack>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * Активні набори для панелі стікерів у месенджері.
     *
     * @return list<array<string, mixed>>
     */
    public static function catalog(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => array_values(self::query()
            ->active()
            ->whereHas('stickers')
            ->with('stickers')
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->map(fn (StickerPack $pack) => [
                'id' => $pack->id,
                'slug' => $pack->slug,
                'name' => $pack->name,
                'is_plus' => $pack->is_plus,
                'stickers' => array_values($pack->stickers->map->toCard()->all()),
            ])
            ->all()));
    }
}
