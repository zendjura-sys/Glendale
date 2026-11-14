<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Учасник шоу.
 *
 * @property int $id
 * @property int $live_show_id
 * @property int $user_id
 * @property string $role host | speaker | guest | listener
 * @property Carbon|null $hand_at
 * @property Carbon|null $mic_until
 * @property Carbon|null $seen_at
 */
#[Fillable(['live_show_id', 'user_id', 'role', 'hand_at', 'mic_until', 'seen_at'])]
class LiveShowMember extends Model
{
    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['hand_at' => 'datetime', 'mic_until' => 'datetime', 'seen_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<LiveShow, $this> */
    public function show(): BelongsTo
    {
        return $this->belongsTo(LiveShow::class, 'live_show_id');
    }

    /** Чи може зараз говорити: ведучі, співведучі й гість, поки йде його хвилина. */
    public function canSpeak(): bool
    {
        return in_array($this->role, ['host', 'speaker'], true)
            || ($this->role === 'guest' && $this->mic_until !== null && $this->mic_until->isFuture());
    }
}
