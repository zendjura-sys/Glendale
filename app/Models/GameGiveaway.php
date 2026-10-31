<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Роздача гри (Epic, Steam, GOG): дані GamerPower, оновлюються щогодини.
 *
 * @property int $id
 * @property int $external_id
 * @property string $title
 * @property string $store
 * @property string|null $worth
 * @property string|null $image
 * @property string|null $description
 * @property string $url
 * @property int|null $game_id
 * @property bool $active
 * @property Carbon|null $published_at
 * @property Carbon|null $ends_at
 * @property Carbon $created_at
 * @property-read Game|null $game
 */
#[Fillable(['external_id', 'title', 'store', 'worth', 'image', 'description', 'url', 'game_id', 'active', 'published_at', 'ends_at'])]
class GameGiveaway extends Model
{
    public const STORES = ['epic' => 'Epic Games', 'steam' => 'Steam', 'gog' => 'GOG', 'other' => 'Інше'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'published_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'store' => $this->store,
            'store_label' => self::STORES[$this->store] ?? $this->store,
            'worth' => $this->worth,
            'image' => $this->image,
            'description' => $this->description,
            'url' => $this->url,
            'ends_at' => $this->ends_at?->toIso8601String(),
            'game' => $this->game?->toCard(),
        ];
    }
}
