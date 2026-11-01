<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Добірка фільмів людини: публічна (лайки, стеження) або лише для себе.
 *
 * @property int $id
 * @property int $user_id
 * @property string $title
 * @property string|null $description
 * @property bool $is_public
 * @property int $items_count
 * @property int $likes_count
 * @property int $followers_count
 * @property Carbon $updated_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'title', 'description', 'is_public', 'items_count', 'likes_count', 'followers_count'])]
class MovieList extends Model
{
    public const MAX_ITEMS = 100;

    public const MAX_LISTS = 30;

    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsToMany<Movie, $this> */
    public function movies(): BelongsToMany
    {
        return $this->belongsToMany(Movie::class, 'movie_list_items')->withPivot(['position', 'note'])->orderByPivot('position');
    }

    public function visibleTo(?User $viewer): bool
    {
        return $this->is_public || ($viewer !== null && ($viewer->id === $this->user_id || $viewer->isStaff()));
    }

    /**
     * Картка для стрічки добірок: до чотирьох постерів.
     *
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'is_public' => $this->is_public,
            'items_count' => $this->items_count,
            'likes_count' => $this->likes_count,
            'followers_count' => $this->followers_count,
            'user' => $this->user?->toCard(),
            'posters' => $this->movies()->limit(4)->get()->map(fn (Movie $m) => $m->poster)->filter()->values()->all(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}
