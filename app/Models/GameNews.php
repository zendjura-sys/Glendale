<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Новина чи патчноут гри зі Steam.
 *
 * @property int $id
 * @property int $game_id
 * @property string $gid
 * @property string $title
 * @property string $url
 * @property string|null $excerpt
 * @property bool $is_patch
 * @property CarbonInterface $published_at
 * @property-read Game $game
 */
class GameNews extends Model
{
    protected $table = 'game_news';

    protected $fillable = ['game_id', 'gid', 'title', 'url', 'excerpt', 'is_patch', 'published_at'];

    protected function casts(): array
    {
        return ['is_patch' => 'boolean', 'published_at' => 'datetime'];
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
            'url' => $this->url,
            'excerpt' => $this->excerpt,
            'patch' => $this->is_patch,
            'published_at' => $this->published_at->toIso8601String(),
        ];
    }
}
