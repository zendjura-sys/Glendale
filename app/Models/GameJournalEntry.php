<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Запис ігрового щоденника.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $game_id
 * @property string $body
 * @property string $mood great|good|meh|bad
 * @property int|null $minutes
 * @property Carbon $played_on
 * @property bool $is_public
 * @property Carbon $created_at
 * @property-read Game|null $game
 */
#[Fillable(['user_id', 'game_id', 'body', 'mood', 'minutes', 'played_on', 'is_public'])]
class GameJournalEntry extends Model
{
    public const MOODS = ['great', 'good', 'meh', 'bad'];

    protected function casts(): array
    {
        return ['played_on' => 'date', 'is_public' => 'boolean'];
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /** @return BelongsTo<User, $this> */
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
            'body' => $this->body,
            'mood' => $this->mood,
            'minutes' => $this->minutes,
            'played_on' => $this->played_on->toDateString(),
            'is_public' => $this->is_public,
            'game' => $this->game?->toCard(),
        ];
    }
}
