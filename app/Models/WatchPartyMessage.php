<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Репліка в чаті спільного перегляду.
 *
 * @property int $id
 * @property int $watch_party_id
 * @property int $user_id
 * @property string $body
 * @property Carbon $created_at
 */
#[Fillable(['watch_party_id', 'user_id', 'body', 'created_at'])]
class WatchPartyMessage extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
