<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * «Готовий грати зараз» до вказаного часу — у яку гру (чи будь-яку) і коротка примітка.
 *
 * @property int $user_id
 * @property int|null $game_id
 * @property string|null $note
 * @property Carbon $until
 * @property-read User $user
 * @property-read Game|null $game
 */
#[Fillable(['user_id', 'game_id', 'note', 'until'])]
class ReadyToPlay extends Model
{
    protected $table = 'ready_to_play';

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return ['until' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Game, $this>
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function isActive(): bool
    {
        return $this->until->isFuture();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'user' => $this->user->toCard(),
            'game' => $this->game?->is_published ? $this->game->toCard() : null,
            'note' => $this->note,
            'until' => $this->until->toIso8601String(),
        ];
    }
}
