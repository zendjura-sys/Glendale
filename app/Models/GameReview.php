<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Огляд гравця на гру.
 *
 * @property int $id
 * @property int $user_id
 * @property int $game_id
 * @property string $body
 * @property int $score 1–10
 * @property array<string, int>|null $criteria Оцінки за критеріями (ReviewCriteria)
 * @property bool $recommended
 * @property int|null $hours
 * @property int $helpful_count
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'game_id', 'body', 'score', 'recommended', 'hours', 'helpful_count', 'criteria'])]
class GameReview extends Model
{
    protected function casts(): array
    {
        return [
            'criteria' => 'array', 'recommended' => 'boolean'];
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

    /**
     * @return array<string, mixed>
     */
    public function toCard(bool $helpful = false, ?int $viewerId = null): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'score' => $this->score,
            'criteria' => $this->criteria,
            'recommended' => $this->recommended,
            'hours' => $this->hours,
            'helpful_count' => $this->helpful_count,
            'helpful' => $helpful,
            'mine' => $viewerId !== null && $viewerId === $this->user_id,
            'user' => $this->user?->toCard(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
