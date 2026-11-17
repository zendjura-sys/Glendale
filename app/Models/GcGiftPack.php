<?php

namespace App\Models;

use App\Support\Shows\GiftRarities;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Пак подарунків GameCast: назву задає адміністратор.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string $emoji
 * @property int $price
 * @property int $gifts_count
 * @property array<string, int> $odds
 * @property int $pity_after
 * @property bool $is_active
 * @property int $position
 */
#[Fillable(['name', 'slug', 'description', 'emoji', 'price', 'gifts_count', 'odds', 'pity_after', 'is_active', 'position'])]
class GcGiftPack extends Model
{
    protected $table = 'gc_gift_packs';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'odds' => 'array',
            'is_active' => 'boolean',
            'price' => 'integer',
            'gifts_count' => 'integer',
            'pity_after' => 'integer',
            'position' => 'integer',
        ];
    }

    /** @param  Builder<self>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    public static function makeSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'pack';
        $slug = $base;
        for ($i = 2; self::query()->where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return mb_substr($slug, 0, 80);
    }

    /** @return array<string, mixed> */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'emoji' => $this->emoji,
            'price' => $this->price,
            'gifts_count' => $this->gifts_count,
            'odds' => GiftRarities::sanitizeOdds($this->odds),
            'pity_after' => $this->pity_after,
            'is_active' => $this->is_active,
            'position' => $this->position,
        ];
    }
}
