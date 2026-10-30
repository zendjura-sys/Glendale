<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Наставник у грі.
 *
 * @property int $id
 * @property int $game_id
 * @property int $user_id
 * @property string $about
 * @property int $helped_count
 */
#[Fillable(['game_id', 'user_id', 'about', 'helped_count'])]
class GameMentor extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
