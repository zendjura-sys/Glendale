<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Серія записів автора: записи йдуть по порядку (series_position).
 *
 * @property int $id
 * @property int $user_id
 * @property string $title
 * @property string|null $description
 * @property int|null $posts_count
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'title', 'description'])]
class PostSeries extends Model
{
    protected $table = 'post_series';

    /** Скільки записів може бути в одній серії. */
    public const MAX_POSTS = 50;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Post, $this> */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class, 'series_id')->orderBy('series_position')->orderBy('id');
    }
}
