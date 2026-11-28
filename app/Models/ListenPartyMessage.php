<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Репліка в чаті кімнати «Слухати разом» або реакція емодзі на трек.
 *
 * @property int $id
 * @property int $listen_party_id
 * @property int $user_id
 * @property string|null $emoji
 * @property string|null $body
 * @property Carbon $created_at
 */
#[Fillable(['listen_party_id', 'user_id', 'emoji', 'body', 'created_at'])]
class ListenPartyMessage extends Model
{
    public $timestamps = false;

    /** Реакції, які можна надіслати в кімнату. */
    public const EMOJI = ['🔥', '❤️', '😂', '👏', '🎉', '😮', '💃', '🤘'];

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

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'emoji' => $this->emoji,
            'body' => $this->body,
            'user' => $this->user?->toCard(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
