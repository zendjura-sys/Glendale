<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Дуель між двома гравцями.
 *
 * @property int $id
 * @property int|null $game_id
 * @property int $challenger_id
 * @property int $opponent_id
 * @property string $terms
 * @property string $status pending | accepted | declined | cancelled | finished | disputed
 * @property int|null $challenger_pick
 * @property int|null $opponent_pick
 * @property int|null $winner_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['game_id', 'challenger_id', 'opponent_id', 'terms', 'status', 'challenger_pick', 'opponent_pick', 'winner_id'])]
class Duel extends Model
{
    /** @return BelongsTo<User, $this> */
    public function challenger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'challenger_id');
    }

    /** @return BelongsTo<User, $this> */
    public function opponent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opponent_id');
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
