<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Гра в списку бажаного: сповістимо про знижку (або коли ціна впаде до target_price, $)
 * і коли її роздаватимуть безкоштовно. notified_price — за якою ціною вже сповіщали.
 *
 * @property int $id
 * @property int $user_id
 * @property int $game_id
 * @property string|null $target_price
 * @property string|null $notified_price
 * @property Carbon|null $notified_at
 * @property Carbon $created_at
 * @property-read User $user
 * @property-read Game $game
 */
#[Fillable(['user_id', 'game_id', 'target_price', 'notified_price', 'notified_at'])]
class GameWishlist extends Model
{
    protected function casts(): array
    {
        return ['target_price' => 'decimal:2', 'notified_price' => 'decimal:2', 'notified_at' => 'datetime'];
    }

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
