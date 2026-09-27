<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Фільм або серіал кінопорталу. */
class Title extends Model
{
    protected $table = 'cinema_titles';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'release_date' => 'date',
            'countries' => 'array',
            'kodik_translations' => 'array',
            'kodik_checked_at' => 'datetime',
            'is_published' => 'boolean',
            'is_featured' => 'boolean',
            'vote_average' => 'float',
            'local_rating' => 'float',
        ];
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class, 'cinema_title_genre', 'title_id', 'genre_id');
    }

    public function seasons(): HasMany
    {
        return $this->hasMany(Season::class, 'title_id')->orderBy('number');
    }

    public function credits(): HasMany
    {
        return $this->hasMany(Credit::class, 'title_id')->orderBy('position');
    }

    public function videos(): HasMany
    {
        return $this->hasMany(Video::class, 'title_id');
    }

    public function isSeries(): bool
    {
        return $this->type === 'series';
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }
}
