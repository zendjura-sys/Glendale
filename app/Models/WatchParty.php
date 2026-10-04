<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Спільний перегляд фільму. Доступ — за посиланням із кодом.
 *
 * @property int $id
 * @property string $code
 * @property int $movie_id
 * @property int $host_id
 * @property string|null $player_key
 * @property bool $playing
 * @property float $position
 * @property int $state_ms
 * @property bool $shared_control
 * @property Carbon|null $ended_at
 * @property Carbon $created_at
 */
#[Fillable(['code', 'movie_id', 'host_id', 'player_key', 'playing', 'position', 'state_ms', 'shared_control', 'ended_at'])]
class WatchParty extends Model
{
    /** Скільки секунд без сигналу людина ще вважається в кімнаті. */
    public const ONLINE_SECONDS = 45;

    protected function casts(): array
    {
        return [
            'playing' => 'boolean',
            'position' => 'float',
            'state_ms' => 'integer',
            'shared_control' => 'boolean',
            'ended_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * @return BelongsTo<Movie, $this>
     */
    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /**
     * @return HasMany<WatchPartyMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(WatchPartyMember::class);
    }

    /**
     * @return HasMany<WatchPartyMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(WatchPartyMessage::class);
    }

    public function isLive(): bool
    {
        return $this->ended_at === null;
    }

    public function canControl(User $user): bool
    {
        return $user->id === $this->host_id || $this->shared_control;
    }

    /** Де фільм зараз: позиція плюс час, що минув, якщо грає. */
    public function currentPosition(?int $nowMs = null): float
    {
        if (! $this->playing) {
            return $this->position;
        }
        $elapsed = max(0, (($nowMs ?? (int) floor(microtime(true) * 1000)) - $this->state_ms) / 1000);

        return $this->position + $elapsed;
    }

    /** Назва кімнати в LiveKit для голосу під час перегляду. */
    public function livekitName(): string
    {
        return 'watch-'.$this->id;
    }
}
