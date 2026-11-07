<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Рецензія на фільм чи серіал: оцінка (вона ж оцінка людини в Кіно) і текст; спойлер ховається.
 *
 * @property int $id
 * @property int $user_id
 * @property int $movie_id
 * @property string $body
 * @property int $score 1–10
 * @property bool $spoiler
 * @property int $likes_count
 * @property Carbon $created_at
 * @property-read User|null $user
 * @property-read Movie|null $movie
 */
#[Fillable(['user_id', 'movie_id', 'body', 'score', 'spoiler', 'likes_count'])]
class MovieReview extends Model
{
    protected function casts(): array
    {
        return ['spoiler' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Movie, $this> */
    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(bool $liked = false, ?int $viewerId = null, bool $withMovie = false): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'score' => $this->score,
            'spoiler' => $this->spoiler,
            'likes_count' => $this->likes_count,
            'liked' => $liked,
            'mine' => $viewerId !== null && $viewerId === $this->user_id,
            'user' => $this->user?->toCard(),
            'movie' => $withMovie ? $this->movie?->toCard() : null,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
