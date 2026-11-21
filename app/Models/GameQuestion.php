<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Питання гравця на сторінці гри.
 *
 * @property int $id
 * @property int $game_id
 * @property int $user_id
 * @property string $title
 * @property string|null $body
 * @property int $answers_count
 * @property int|null $solved_answer_id
 * @property Carbon $created_at
 */
#[Fillable(['game_id', 'user_id', 'title', 'body', 'answers_count', 'solved_answer_id'])]
class GameQuestion extends Model
{
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

    /** @return HasMany<GameAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(GameAnswer::class, 'question_id');
    }
}
