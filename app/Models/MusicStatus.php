<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Останній трек, який слухає користувач (для «Зараз грає»).
 *
 * @property int $user_id
 * @property string $source
 * @property int|null $track_id
 * @property array<string, mixed>|null $payload
 * @property Carbon|null $expires_at
 * @property Carbon|null $updated_at
 * @property-read Track|null $track
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'source', 'track_id', 'payload', 'expires_at'])]
class MusicStatus extends Model
{
    public const CREATED_AT = null;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'expires_at' => 'datetime',
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
     * @return BelongsTo<Track, $this>
     */
    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class)->withTrashed();
    }

    public function isActive(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isFuture();
    }
}
