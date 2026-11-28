<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Варіант ігрового вечора: час (kind=time) або гра (kind=game).
 *
 * @property int $id
 * @property int $game_night_id
 * @property string $kind
 * @property Carbon|null $starts_at
 * @property int|null $game_id
 */
#[Fillable(['game_night_id', 'kind', 'starts_at', 'game_id'])]
class GameNightOption extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['starts_at' => 'datetime'];
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
