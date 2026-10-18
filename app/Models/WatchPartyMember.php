<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Глядач спільного перегляду; онлайн, поки сторінка надсилає сигнал.
 *
 * @property int $watch_party_id
 * @property int $user_id
 * @property Carbon $last_seen_at
 */
#[Fillable(['watch_party_id', 'user_id', 'last_seen_at'])]
class WatchPartyMember extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['last_seen_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<WatchParty, $this>
     */
    public function party(): BelongsTo
    {
        return $this->belongsTo(WatchParty::class, 'watch_party_id');
    }
}
