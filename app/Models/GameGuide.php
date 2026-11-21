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
 * @property int $helpful_count
 * @property int $unhelpful_count
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

    /**
     * Корисність для сортування: нижня межа інтервалу Вілсона (95 %) — один голос «корисно»
     * не обганяє гід із 40 «корисно» з 45.
     */
    public function usefulness(): float
    {
        $n = $this->helpful_count + $this->unhelpful_count;
        if ($n === 0) {
            return 0.0;
        }
        $z = 1.96;
        $p = $this->helpful_count / $n;

        return ($p + $z * $z / (2 * $n) - $z * sqrt(($p * (1 - $p) + $z * $z / (4 * $n)) / $n)) / (1 + $z * $z / $n);
    }
}
