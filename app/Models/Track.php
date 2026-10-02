<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $title
 * @property string $artist
 * @property string|null $album
 * @property string|null $genre
 * @property int $duration
 * @property string $path
 * @property string|null $cover_path
 * @property string|null $mime
 * @property int $size
 * @property int $plays_count
 * @property int $adds_count
 * @property Carbon $created_at
 * @property Carbon|null $deleted_at
 * @property-read string $url
 * @property-read string|null $cover_url
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'title', 'artist', 'album', 'genre', 'duration', 'path', 'cover_path', 'mime', 'size'])]
class Track extends Model
{
    use SoftDeletes;

    public const AUDIO_MIMES = ['mp3', 'mpga', 'm4a', 'mp4', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'webm'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function listeners(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'music_library')->withPivot('created_at');
    }

    /**
     * @param  Builder<Track>  $query
     */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
        $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('artist', 'like', $like)->orWhere('album', 'like', $like));
    }

    /**
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function coverUrl(): Attribute
    {
        return Attribute::get(fn () => $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(bool $inLibrary = false): array
    {
        return [
            'source' => 'local',
            'id' => $this->id,
            'key' => 'local:'.$this->id,
            'title' => $this->title,
            'artist' => $this->artist,
            'album' => $this->album,
            'genre' => $this->genre,
            'duration' => $this->duration,
            'url' => $this->url,
            'cover_url' => $this->cover_url,
            'plays_count' => $this->plays_count,
            'user_id' => $this->user_id,
            'in_library' => $inLibrary,
        ];
    }
}
