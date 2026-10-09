<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $album_id
 * @property int|null $user_id
 * @property string $path
 * @property int|null $width
 * @property int|null $height
 * @property int|null $size
 * @property string|null $caption
 * @property string|null $alt
 * @property bool $is_sensitive
 * @property int $likes_count
 * @property int $comments_count
 * @property int $views_count
 * @property Carbon $created_at
 * @property-read string $url
 * @property-read PhotoAlbum $album
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'path', 'width', 'height', 'size', 'caption', 'alt', 'is_sensitive'])]
class Photo extends Model
{
    use SoftDeletes;

    protected $appends = ['url'];

    protected function casts(): array
    {
        return ['is_sensitive' => 'boolean'];
    }

    /**
     * @return BelongsTo<PhotoAlbum, $this>
     */
    public function album(): BelongsTo
    {
        return $this->belongsTo(PhotoAlbum::class, 'album_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<Comment, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    /**
     * @return MorphMany<Like, $this>
     */
    public function likes(): MorphMany
    {
        return $this->morphMany(Like::class, 'likeable');
    }

    /**
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }

    /**
     * @return array{id: int, url: string, width: int|null, height: int|null, likes_count: int, comments_count: int, alt: string|null, is_sensitive: bool}
     */
    public function toThumb(): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'width' => $this->width,
            'height' => $this->height,
            'likes_count' => $this->likes_count,
            'comments_count' => $this->comments_count,
            'alt' => $this->alt,
            'is_sensitive' => $this->is_sensitive,
        ];
    }
}
