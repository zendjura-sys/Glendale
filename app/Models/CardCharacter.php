<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Персонаж аніме, фільму чи серіалу для колекційних карток.
 *
 * @property int $id
 * @property int $movie_id
 * @property string $source shikimori | tmdb
 * @property string $source_id
 * @property string $name
 * @property string|null $image_url
 * @property string $role main | supporting
 * @property int $popularity
 * @property bool $is_hidden
 */
#[Fillable(['movie_id', 'source', 'source_id', 'name', 'image_url', 'role', 'popularity', 'is_hidden'])]
class CardCharacter extends Model
{
    protected function casts(): array
    {
        return ['is_hidden' => 'boolean', 'popularity' => 'integer'];
    }

    /**
     * @return BelongsTo<Movie, $this>
     */
    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
