<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Спільне прослуховування музики. Доступ — за посиланням із кодом.
 *
 * @property int $id
 * @property string $code
 * @property int $host_id
 * @property string|null $group_type family | clan | community; null — кімната з друзями
 * @property int|null $group_id
 * @property string|null $title
 * @property int|null $track_id
 * @property int|null $station_id
 * @property list<array{track_id?: int, station_id?: int, by: int}>|null $queue
 * @property list<array{track_id?: int, station_id?: int, by: int}>|null $suggestions
 * @property bool $moderated
 * @property bool $playing
 * @property float $position
 * @property int $state_ms
 * @property bool $shared_control
 * @property bool $repeat
 * @property Carbon|null $ended_at
 * @property Carbon $created_at
 */
#[Fillable(['code', 'host_id', 'group_type', 'group_id', 'title', 'track_id', 'station_id', 'queue', 'suggestions', 'playing', 'position', 'state_ms', 'shared_control', 'moderated', 'repeat', 'ended_at'])]
class ListenParty extends Model
{
    /** Скільки секунд без сигналу людина ще вважається слухачем. */
    public const ONLINE_SECONDS = 45;

    /** Найбільша довжина черги. */
    public const QUEUE_LIMIT = 100;

    /** Групи, у яких відкривають кімнати «Слухати разом». */
    public const GROUP_TYPES = ['family', 'clan', 'community'];

    /** Кімната без жодного слухача завершується через стільки хвилин. */
    public const IDLE_MINUTES = 10;

    protected function casts(): array
    {
        return [
            'queue' => 'array',
            'suggestions' => 'array',
            'moderated' => 'boolean',
            'playing' => 'boolean',
            'position' => 'float',
            'state_ms' => 'integer',
            'shared_control' => 'boolean',
            'repeat' => 'boolean',
            'ended_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /**
     * @return BelongsTo<Track, $this>
     */
    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    /**
     * @return BelongsTo<RadioStation, $this>
     */
    public function station(): BelongsTo
    {
        return $this->belongsTo(RadioStation::class);
    }

    /**
     * @return HasMany<ListenPartyMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(ListenPartyMessage::class);
    }

    /**
     * @return HasMany<ListenPartyMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(ListenPartyMember::class);
    }

    public function isLive(): bool
    {
        return $this->ended_at === null;
    }

    /** Кімната групи (сім’ї, клану чи спільноти), а не посилання для друзів. */
    public function isGroupRoom(): bool
    {
        return $this->group_type !== null && $this->group_id !== null;
    }

    public function canControl(User $user): bool
    {
        return $user->id === $this->host_id || $this->shared_control;
    }

    /** Де трек зараз: позиція плюс час, що минув, якщо грає. */
    public function currentPosition(?int $nowMs = null): float
    {
        if (! $this->playing) {
            return $this->position;
        }
        $nowMs ??= (int) floor(microtime(true) * 1000);

        return $this->position + max(0, $nowMs - $this->state_ms) / 1000;
    }
}
