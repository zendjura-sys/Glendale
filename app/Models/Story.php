<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Історія: фото чи коротке відео, видно 24 години.
 *
 * @property int $id
 * @property int $user_id
 * @property string $media_type
 * @property string $path
 * @property int $width
 * @property int $height
 * @property int $duration
 * @property string|null $caption
 * @property string $privacy
 * @property int $views_count
 * @property Carbon $expires_at
 * @property Carbon $created_at
 * @property-read string $url
 */
#[Fillable(['user_id', 'media_type', 'path', 'width', 'height', 'duration', 'caption', 'privacy', 'expires_at'])]
class Story extends Model
{
    public const TYPE_IMAGE = 'image';

    public const TYPE_VIDEO = 'video';

    public const PRIVACY_FRIENDS = 'friends';

    public const PRIVACY_EVERYONE = 'everyone';

    public const PRIVACIES = [self::PRIVACY_FRIENDS, self::PRIVACY_EVERYONE];

    /** Скільки годин живе історія. */
    public const LIFETIME_HOURS = 24;

    /** Скільки секунд показується фото; відео — до 60 секунд. */
    public const IMAGE_SECONDS = 6;

    public const MAX_VIDEO_SECONDS = 60;

    /** Реакції одним дотиком. */
    public const REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<StoryView, $this>
     */
    public function views(): HasMany
    {
        return $this->hasMany(StoryView::class);
    }

    /**
     * @param  Builder<Story>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('expires_at', '>', now());
    }

    /**
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }
}
