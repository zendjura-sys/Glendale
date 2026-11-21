<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $community_quiz_id
 * @property int $user_id
 * @property int $question
 * @property int $choice
 * @property int $points
 */
#[Fillable(['community_quiz_id', 'user_id', 'question', 'choice', 'points'])]
class CommunityQuizAnswer extends Model
{
    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
