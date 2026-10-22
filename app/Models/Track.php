<?php

namespace App\Models;

use App\Services\Music\AudioProbe;
use App\Support\Plugins\Plugins;
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
 * @property string|null $lyrics
 * @property int $duration
 * @property string $path
 * @property string|null $cover_path
 * @property string|null $mime
 * @property int|null $year
 * @property int|null $track_no
 * @property string|null $codec
 * @property int|null $sample_rate
 * @property int|null $bit_depth
 * @property int|null $bitrate
 * @property int|null $channels
 * @property string|null $quality
 * @property string|null $stream_path
 * @property bool $processing
 * @property int $size
 * @property int $plays_count
 * @property int $adds_count
 * @property Carbon $created_at
 * @property Carbon|null $deleted_at
 * @property-read string $url
 * @property-read string|null $cover_url
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'title', 'artist', 'album', 'genre', 'year', 'track_no', 'lyrics', 'duration', 'path', 'stream_path', 'processing', 'cover_path', 'mime', 'codec', 'sample_rate', 'bit_depth', 'bitrate', 'channels', 'quality', 'size'])]
class Track extends Model
{
    use SoftDeletes;

    public const AUDIO_MIMES = ['mp3', 'mpga', 'm4a', 'mp4', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'webm'];

    /** Формати, які приймаємо лише з ffmpeg на сервері: файл перевіряє ffprobe, для браузера робиться копія AAC. */
    public const FFMPEG_MIMES = ['aiff', 'aif', 'wma', 'ape', 'wv', 'tta', 'ac3', 'amr', 'mka', 'caf', 'dsf'];

    /** Формати для завантаження: «рідні» плюс ті, що розбирає ffmpeg, якщо він є на сервері. */
    public static function uploadFormats(): array
    {
        return app(AudioProbe::class)->available() ? [...self::AUDIO_MIMES, ...self::FFMPEG_MIMES] : self::AUDIO_MIMES;
    }

    /** Якість звуку: стиснений, без втрат (до 48 кГц) і високої роздільності (понад 48 кГц). */
    public const QUALITY_LOSSY = 'lossy';

    public const QUALITY_LOSSLESS = 'lossless';

    public const QUALITY_HIRES = 'hires';

    protected function casts(): array
    {
        return ['processing' => 'boolean'];
    }

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
     * Адреса для відтворення: копія для браузера, якщо оригінал грає не скрізь (ALAC, AIFF, WMA…).
     *
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->stream_path ?? $this->path));
    }

    /**
     * @param  Builder<Track>  $query
     */
    public function scopeReady(Builder $query): void
    {
        $query->where('processing', false);
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
            'year' => $this->year,
            'quality' => $this->quality,
            'has_lyrics' => filled($this->lyrics) && app(Plugins::class)->on('lyrics'),
            'duration' => $this->duration,
            'url' => $this->url,
            'cover_url' => $this->cover_url,
            'plays_count' => $this->plays_count,
            'user_id' => $this->user_id,
            'in_library' => $inLibrary,
        ];
    }
}
