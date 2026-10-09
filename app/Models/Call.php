<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Дзвінок у бесіді: особистий або груповий. Поки триває, до групового можна приєднатися будь-коли.
 *
 * @property int $id
 * @property int $conversation_id
 * @property int|null $started_by
 * @property string $status
 * @property Carbon|null $answered_at
 * @property Carbon|null $ended_at
 * @property Carbon $created_at
 */
#[Fillable(['conversation_id', 'started_by', 'status', 'answered_at', 'ended_at'])]
class Call extends Model
{
    public const STATUS_RINGING = 'ringing';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ENDED = 'ended';

    /** Скільки дзвонить без відповіді, поки дзвінок не стане пропущеним. */
    public const RING_SECONDS = 45;

    protected function casts(): array
    {
        return [
            'answered_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    /**
     * @return HasMany<CallParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(CallParticipant::class);
    }

    public function isLive(): bool
    {
        return $this->status !== self::STATUS_ENDED;
    }

    /** Назва кімнати в LiveKit. */
    public function livekitName(): string
    {
        return 'call-'.$this->id;
    }

    public static function idFromLivekit(string $name): ?int
    {
        return preg_match('/^call-(\d+)$/', $name, $m) === 1 ? (int) $m[1] : null;
    }
}
