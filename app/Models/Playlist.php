<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $user_id
 * @property string $title
 * @property string|null $description
 * @property string|null $cover_path
 * @property bool $is_public
 * @property int $tracks_count
 * @property int $duration
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read string|null $cover_url
 * @property-read User $user
 */
#[Fillable(['title', 'description', 'cover_path', 'is_public'])]
class Playlist extends Model
{
    public const MAX_PER_USER = 200;

    public const MAX_TRACKS = 1000;

    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsToMany<Track, $this>
     */
    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(Track::class)->withPivot(['id', 'position', 'created_at'])->orderByPivot('position');
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function coverUrl(): Attribute
    {
        return Attribute::get(fn () => $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null);
    }

    public function recount(): void
    {
        $stats = $this->tracks()->reorder()->selectRaw('count(*) as aggregate, coalesce(sum(tracks.duration), 0) as total')->first();
        $this->forceFill(['tracks_count' => (int) $stats?->aggregate, 'duration' => (int) $stats?->total])->saveQuietly();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        $covers = $this->relationLoaded('tracks')
            ? $this->tracks->pluck('cover_url')->filter()->unique()->take(4)->values()->all()
            : [];

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'cover_url' => $this->cover_url,
            'covers' => $covers,
            'is_public' => $this->is_public,
            'tracks_count' => $this->tracks_count,
            'duration' => $this->duration,
            'user_id' => $this->user_id,
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}
