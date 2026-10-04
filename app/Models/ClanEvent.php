<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Захід клану (рейд, турнір, збір) із відмітками «Іду».
 *
 * @property int $id
 * @property int $clan_id
 * @property int|null $user_id
 * @property string $title
 * @property string|null $description
 * @property Carbon $starts_at
 * @property Carbon|null $reminded_at
 */
#[Fillable(['clan_id', 'user_id', 'title', 'description', 'starts_at', 'reminded_at'])]
class ClanEvent extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'reminded_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function going(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'clan_event_rsvps', 'clan_event_id', 'user_id');
    }
}
