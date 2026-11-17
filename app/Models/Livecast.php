<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * LiveCast: нативний відеострім LiveKit «livecast-{id}» — окремо від GameCast і Twitch/YouTube.
 *
 * @property int $id
 * @property int $host_id
 * @property string $title
 * @property string|null $category
 * @property string $status live | ended
 * @property int $viewers
 * @property int $peak_viewers
 * @property Carbon|null $started_at
 * @property Carbon|null $ended_at
 */
#[Fillable(['host_id', 'title', 'category', 'status', 'viewers', 'peak_viewers', 'started_at', 'ended_at'])]
class Livecast extends Model
{
    public const LIVE = 'live';

    public const ENDED = 'ended';

    protected $table = 'livecasts';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /** @return HasMany<LivecastMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(LivecastMessage::class);
    }

    public function livekitName(): string
    {
        return 'livecast-'.$this->id;
    }

    public function isLive(): bool
    {
        return $this->status === self::LIVE;
    }
}
