<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Ідея на дошці ідей.
 *
 * @property int $id
 * @property int $user_id
 * @property string $title
 * @property string|null $body
 * @property string $status
 * @property string|null $answer
 * @property int $votes_count
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'title', 'body', 'status', 'answer', 'votes_count'])]
class Idea extends Model
{
    public const STATUSES = ['new', 'planned', 'progress', 'done', 'declined'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
