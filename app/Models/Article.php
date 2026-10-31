<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Стаття: огляд, історія чи гайд. Текст — Markdown, на сторінці — зміст за заголовками.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $game_id
 * @property string $slug
 * @property string $title
 * @property string|null $excerpt
 * @property string|null $cover_path
 * @property string $body
 * @property bool $is_published
 * @property Carbon|null $published_at
 * @property int $views_count
 * @property int $reading_minutes
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 * @property-read Game|null $game
 */
#[Fillable(['user_id', 'game_id', 'slug', 'title', 'excerpt', 'cover_path', 'body', 'is_published', 'published_at', 'reading_minutes'])]
class Article extends Model
{
    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'published_at' => 'datetime'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
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
     * @param  Builder<Article>  $query
     * @return Builder<Article>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('is_published', true)->whereNotNull('published_at')->where('published_at', '<=', now());
    }

    public function coverUrl(): ?string
    {
        return $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'cover' => $this->coverUrl(),
            'reading_minutes' => $this->reading_minutes,
            'views_count' => $this->views_count,
            'is_published' => $this->is_published,
            'published_at' => $this->published_at?->toIso8601String(),
            'user' => $this->user->toCard(),
            'game' => $this->game?->toCard(),
        ];
    }
}
