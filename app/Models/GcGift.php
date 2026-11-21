<?php

namespace App\Models;

use App\Support\Shows\GiftRarities;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Каталожний подарунок GameCast (емодзі + рідкість).
 *
 * @property int $id
 * @property string $name
 * @property string $emoji
 * @property string $rarity
 * @property string|null $flavor
 * @property bool $is_active
 * @property int|null $stock
 */
#[Fillable(['name', 'emoji', 'rarity', 'flavor', 'is_active', 'stock'])]
class GcGift extends Model
{
    protected $table = 'gc_gifts';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'stock' => 'integer'];
    }

    /** @param  Builder<self>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    public function available(): bool
    {
        return $this->is_active && ($this->stock === null || $this->stock > 0);
    }

    /** @return array<string, mixed> */
    public function toCard(): array
    {
        $meta = GiftRarities::meta($this->rarity);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'emoji' => $this->emoji,
            'rarity' => $this->rarity,
            'rarity_label' => $meta['label'] ?? $this->rarity,
            'rarity_tone' => $meta['tone'] ?? 'slate',
            'flavor' => $this->flavor,
            'stock' => $this->stock,
            'is_unique' => $this->rarity === GiftRarities::UNIQUE,
        ];
    }
}
