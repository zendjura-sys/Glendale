<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $poll_id
 * @property string $label
 * @property int $position
 * @property int $votes_count
 */
#[Fillable(['poll_id', 'label', 'position', 'votes_count'])]
class PollOption extends Model
{
    public $timestamps = false;

    /**
     * @return BelongsTo<Poll, $this>
     */
    public function poll(): BelongsTo
    {
        return $this->belongsTo(Poll::class);
    }
}
