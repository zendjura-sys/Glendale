<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Слухач спільного прослуховування; онлайн, поки сторінка надсилає сигнал.
 *
 * @property int $listen_party_id
 * @property int $user_id
 * @property Carbon $last_seen_at
 */
#[Fillable(['listen_party_id', 'user_id', 'last_seen_at'])]
class ListenPartyMember extends Model
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
}
