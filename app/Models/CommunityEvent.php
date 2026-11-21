<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Подія в календарі спільноти.
 *
 * @property int $id
 * @property int $community_id
 * @property int|null $user_id
 * @property string $title
 * @property string|null $description
 * @property string|null $place
 * @property Carbon $starts_at
 * @property Carbon|null $ends_at
 * @property int $going_count
 */
#[Fillable(['community_id', 'user_id', 'title', 'description', 'place', 'starts_at', 'ends_at', 'going_count'])]
class CommunityEvent extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<Community, $this> */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
