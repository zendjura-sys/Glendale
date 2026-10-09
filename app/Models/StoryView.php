<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Хто переглянув історію і яку реакцію лишив.
 *
 * @property int $story_id
 * @property int $user_id
 * @property string|null $reaction
 * @property Carbon $viewed_at
 */
#[Fillable(['story_id', 'user_id', 'reaction', 'viewed_at'])]
class StoryView extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['viewed_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
