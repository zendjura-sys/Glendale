<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Конфіг гравця до гри: код прицілу, конфіг, бінди, графіка чи чутливість.
 *
 * @property int $id
 * @property int $user_id
 * @property int $game_id
 * @property string $kind
 * @property string $title
 * @property string $code
 * @property string|null $description
 * @property int $likes_count
 * @property int $copies_count
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'game_id', 'kind', 'title', 'code', 'description', 'likes_count', 'copies_count'])]
class GameConfig extends Model
{
    public const KINDS = ['crosshair', 'config', 'binds', 'graphics', 'sensitivity'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
