<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $platform twitch | youtube
 * @property string $channel логін Twitch, @handle або UC… для YouTube
 * @property bool $is_live
 * @property string|null $title
 * @property string|null $game
 * @property int|null $viewers
 * @property string|null $video_id
 * @property Carbon|null $started_at
 * @property Carbon|null $manual_until
 * @property Carbon|null $notified_at
 * @property Carbon|null $checked_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'platform', 'channel', 'is_live', 'title', 'game', 'viewers', 'video_id', 'started_at', 'manual_until', 'notified_at', 'checked_at'])]
class UserStream extends Model
{
    public const PLATFORMS = ['twitch' => 'Twitch', 'youtube' => 'YouTube'];

    protected function casts(): array
    {
        return [
            'is_live' => 'boolean',
            'started_at' => 'datetime',
            'manual_until' => 'datetime',
            'notified_at' => 'datetime',
            'checked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** В ефірі: так каже Twitch / YouTube або людина сама натиснула «Я в ефірі». */
    public function live(): bool
    {
        return $this->is_live || ($this->manual_until !== null && $this->manual_until->isFuture());
    }

    public function url(): string
    {
        return $this->platform === 'twitch'
            ? 'https://www.twitch.tv/'.$this->channel
            : 'https://www.youtube.com/'.(str_starts_with($this->channel, 'UC') ? 'channel/'.$this->channel : $this->channel).'/live';
    }

    /** Вбудований плеєр (Twitch вимагає домен сайту в parent). */
    public function embed(string $host): ?string
    {
        if ($this->platform === 'twitch') {
            return 'https://player.twitch.tv/?'.http_build_query(['channel' => $this->channel, 'parent' => $host, 'muted' => 'true']);
        }

        return $this->video_id ? 'https://www.youtube-nocookie.com/embed/'.$this->video_id.'?autoplay=1&mute=1' : null;
    }
}
