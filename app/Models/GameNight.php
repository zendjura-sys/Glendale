<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Ігровий вечір: організатор, запрошені друзі, варіанти часу й гри з голосами.
 *
 * @property int $id
 * @property int $user_id
 * @property string $title
 * @property string|null $note
 * @property string $status planning|set|cancelled
 * @property Carbon|null $starts_at
 * @property int|null $game_id
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'title', 'note', 'status', 'starts_at', 'game_id'])]
class GameNight extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /** @return BelongsToMany<User, $this> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'game_night_members')->withPivot('status')->withTimestamps();
    }

    /** @return HasMany<GameNightOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(GameNightOption::class);
    }

    /** Організатор або запрошений. */
    public function involves(User $user): bool
    {
        return $this->user_id === $user->id || $this->members()->whereKey($user->id)->exists();
    }
}
