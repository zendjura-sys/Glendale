<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Відповідь на питання гравця.
 *
 * @property int $id
 * @property int $question_id
 * @property int $user_id
 * @property string $body
 * @property int $votes_count
 * @property Carbon $created_at
 */
#[Fillable(['question_id', 'user_id', 'body', 'votes_count'])]
class GameAnswer extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<GameQuestion, $this> */
    public function question(): BelongsTo
    {
        return $this->belongsTo(GameQuestion::class, 'question_id');
    }
}
