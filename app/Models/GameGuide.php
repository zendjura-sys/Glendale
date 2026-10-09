<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Короткий гід на сторінці гри.
 *
 * @property int $id
 * @property int $game_id
 * @property int $user_id
 * @property string $title
 * @property string $body
 */
#[Fillable(['game_id', 'user_id', 'title', 'body'])]
class GameGuide extends Model
{
    /**
     * @return BelongsTo<Game, $this>
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
