<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Коментар до добірки фільмів.
 *
 * @property int $id
 * @property int $movie_list_id
 * @property int $user_id
 * @property string $body
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['movie_list_id', 'user_id', 'body'])]
class MovieListComment extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Видалити може автор, власник добірки або модератор. */
    public function canDelete(User $viewer, MovieList $list): bool
    {
        return $viewer->id === $this->user_id || $viewer->id === $list->user_id || $viewer->isStaff();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(User $viewer, MovieList $list): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'user' => $this->user?->toCard(),
            'created_at' => $this->created_at->toIso8601String(),
            'can_delete' => $this->canDelete($viewer, $list),
        ];
    }
}
