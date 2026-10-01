<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $slug
 * @property string $type
 * @property string $title
 * @property string|null $title_original
 * @property int|null $year
 * @property string|null $description
 * @property string|null $poster_url
 * @property string|null $backdrop_url
 * @property string|null $poster_path
 * @property string|null $backdrop_path
 * @property list<string>|null $genres
 * @property list<string>|null $countries
 * @property int|null $duration
 * @property string|null $age_rating
 * @property float|null $rating_kp
 * @property float|null $rating_imdb
 * @property float|null $rating_shikimori
 * @property float|null $rating_tmdb
 * @property string|null $tagline
 * @property string|null $trailer_url
 * @property string|null $tmdb_id
 * @property string $origin
 * @property Carbon|null $enriched_at
 * @property Carbon|null $synced_at
 * @property string|null $kinopoisk_id
 * @property string|null $imdb_id
 * @property string|null $shikimori_id
 * @property int|null $episodes_count
 * @property bool $is_published
 * @property bool $is_featured
 * @property bool $comments_enabled
 * @property int $views_count
 * @property int $ratings_count
 * @property int $ratings_sum
 * @property int $watchers_count
 * @property int $comments_count
 * @property Carbon $created_at
 * @property Carbon|null $deleted_at
 * @property-read string|null $poster
 * @property-read string|null $backdrop
 */
#[Fillable([
    'user_id', 'slug', 'type', 'title', 'title_original', 'year', 'description', 'poster_url', 'backdrop_url',
    'genres', 'countries', 'duration', 'age_rating', 'rating_kp', 'rating_imdb', 'rating_shikimori',
    'kinopoisk_id', 'imdb_id', 'shikimori_id', 'episodes_count', 'is_published', 'is_featured', 'comments_enabled',
    'tagline', 'trailer_url', 'rating_tmdb', 'tmdb_id', 'origin', 'enriched_at', 'synced_at',
])]
class Movie extends Model
{
    use SoftDeletes;

    public const TYPES = [
        'movie' => 'Фільм',
        'serial' => 'Серіал',
        'anime' => 'Аніме',
        'cartoon' => 'Мультфільм',
        'documentary' => 'Документальне',
    ];

    public const ORIGINS = [
        'manual' => 'Вручну',
        'kodik' => 'Kodik',
        'flixcdn' => 'FlixCDN',
    ];

    public const STATUSES = [
        'planned' => 'Буду дивитися',
        'watching' => 'Дивлюся',
        'watched' => 'Переглянуто',
        'dropped' => 'Закинуто',
    ];

    protected function casts(): array
    {
        return [
            'genres' => 'array',
            'countries' => 'array',
            'rating_kp' => 'float',
            'rating_imdb' => 'float',
            'rating_shikimori' => 'float',
            'rating_tmdb' => 'float',
            'enriched_at' => 'datetime',
            'synced_at' => 'datetime',
            'is_published' => 'boolean',
            'is_featured' => 'boolean',
            'comments_enabled' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<MovieSource, $this>
     */
    public function sources(): HasMany
    {
        return $this->hasMany(MovieSource::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<Comment, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function viewers(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot(['status', 'rating', 'watched_at'])->withTimestamps();
    }

    /**
     * @param  Builder<Movie>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }

    /**
     * @param  Builder<Movie>  $query
     */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
        $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('title_original', 'like', $like));
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function poster(): Attribute
    {
        return Attribute::get(fn () => $this->poster_path ? Storage::disk('public')->url($this->poster_path) : $this->poster_url);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function backdrop(): Attribute
    {
        return Attribute::get(fn () => $this->backdrop_path ? Storage::disk('public')->url($this->backdrop_path) : $this->backdrop_url);
    }

    public function userRating(): ?float
    {
        return $this->ratings_count > 0 ? round($this->ratings_sum / $this->ratings_count, 1) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'href' => '/cinema/'.$this->slug,
            'type' => $this->type,
            'type_label' => self::TYPES[$this->type] ?? $this->type,
            'title' => $this->title,
            'title_original' => $this->title_original,
            'year' => $this->year,
            'poster' => $this->poster,
            'backdrop' => $this->backdrop,
            'genres' => array_slice($this->genres ?? [], 0, 3),
            'rating' => $this->rating_kp ?? $this->rating_imdb ?? $this->rating_tmdb ?? $this->rating_shikimori ?? $this->userRating(),
            'age_rating' => $this->age_rating,
            'episodes_count' => $this->episodes_count,
        ];
    }
}
