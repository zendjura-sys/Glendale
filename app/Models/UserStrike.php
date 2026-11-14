<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Страйк (попередження за порушення).
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $moderator_id
 * @property string $reason
 * @property string $source manual | message_report | user_report
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'moderator_id', 'reason', 'source', 'expires_at', 'revoked_at'])]
class UserStrike extends Model
{
    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }
}
