<?php

namespace App\Models;

use App\Services\Music\ImportFailed;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Завантаження треку за посиланням (ImportTrackFromUrl): pending → downloading → processing → done | failed.
 *
 * @property int $id
 * @property int $user_id
 * @property string $url
 * @property string $host
 * @property array{title?: string|null, artist?: string|null, album?: string|null, genre?: string|null}|null $hints
 * @property string $status
 * @property string|null $error
 * @property int|null $progress
 * @property int|null $bytes
 * @property int|null $track_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Track|null $track
 * @property-read User $user
 */
#[Fillable(['user_id', 'url', 'host', 'hints', 'status', 'error', 'progress', 'bytes', 'track_id'])]
class TrackImport extends Model
{
    public const PENDING = 'pending';

    public const DOWNLOADING = 'downloading';

    public const PROCESSING = 'processing';

    public const DONE = 'done';

    public const FAILED = 'failed';

    /** Стани «ще триває». */
    public const ACTIVE = [self::PENDING, self::DOWNLOADING, self::PROCESSING];

    protected function casts(): array
    {
        return ['hints' => 'array', 'progress' => 'integer', 'bytes' => 'integer'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Track, $this>
     */
    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    /** Скільки хвилин без змін, після яких «активне» завантаження вважаємо завислим (воркер упав тощо). */
    public const STALE_MINUTES = 15;

    /** Завислі завантаження користувача → failed, щоб не займали місце в ліміті одночасних. */
    public static function expireStale(int $userId): void
    {
        self::query()->where('user_id', $userId)->whereIn('status', self::ACTIVE)
            ->where('updated_at', '<', now()->subMinutes(self::STALE_MINUTES))
            ->update(['status' => self::FAILED, 'error' => ImportFailed::STALE, 'progress' => null]);
    }

    public function fail(string $message): void
    {
        $this->forceFill(['status' => self::FAILED, 'error' => mb_substr($message, 0, 300), 'progress' => null])->save();
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE, true);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        $track = $this->status === self::DONE ? $this->track : null;

        return [
            'id' => $this->id,
            'url' => $this->url,
            'host' => $this->host,
            'status' => $this->status,
            'error' => $this->error,
            'progress' => $this->progress,
            'track' => $track?->toCard(true),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
