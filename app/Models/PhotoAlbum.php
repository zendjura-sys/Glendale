<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $owner_type
 * @property int $owner_id
 * @property string $title
 * @property string|null $description
 * @property string $privacy
 * @property bool $comments_enabled
 * @property int|null $cover_photo_id
 * @property int $photos_count
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User|Community|null $owner
 * @property-read Photo|null $cover
 */
#[Fillable(['title', 'description', 'privacy', 'comments_enabled', 'cover_photo_id'])]
class PhotoAlbum extends Model
{
    public const PRIVACY_PUBLIC = 'public';

    public const PRIVACY_FRIENDS = 'friends';

    public const PRIVACY_PRIVATE = 'private';

    public const PRIVACIES = [self::PRIVACY_PUBLIC, self::PRIVACY_FRIENDS, self::PRIVACY_PRIVATE];

    public const MAX_PER_OWNER = 100;

    protected function casts(): array
    {
        return [
            'comments_enabled' => 'boolean',
        ];
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return HasMany<Photo, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class, 'album_id');
    }

    /**
     * @return BelongsTo<Photo, $this>
     */
    public function cover(): BelongsTo
    {
        return $this->belongsTo(Photo::class, 'cover_photo_id');
    }

    public function ownedByCommunity(): bool
    {
        return $this->owner_type === (new Community)->getMorphClass();
    }

    public function recount(): void
    {
        $count = $this->photos()->count();
        $cover = $this->cover_photo_id && $this->photos()->whereKey($this->cover_photo_id)->exists()
            ? $this->cover_photo_id
            : $this->photos()->latest('id')->value('id');

        $this->forceFill(['photos_count' => $count, 'cover_photo_id' => $cover])->saveQuietly();
    }
}
