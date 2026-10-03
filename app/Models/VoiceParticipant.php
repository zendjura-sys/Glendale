<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Хто зараз у голосовій кімнаті (оновлюється вебхуками LiveKit).
 *
 * @property int $voice_room_id
 * @property int $user_id
 * @property bool $muted
 * @property Carbon $joined_at
 */
#[Fillable(['voice_room_id', 'user_id', 'muted', 'joined_at'])]
class VoiceParticipant extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'muted' => 'boolean',
            'joined_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<VoiceRoom, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(VoiceRoom::class, 'voice_room_id');
    }
}
