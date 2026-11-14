<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Момент — кліп гравця з YouTube, Twitch чи Medal.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $game_id
 * @property int|null $gta_server_id
 * @property string $provider youtube | twitch | medal | upload
 * @property string|null $video_path Власний кліп (диск public)
 * @property int|null $duration_ms
 * @property string $status ready | processing | failed
 * @property string $external_id
 * @property string $url
 * @property string|null $embed_url
 * @property string $title
 * @property string|null $thumbnail
 * @property int $likes_count
 * @property Carbon $created_at
 * @property-read User $user
 * @property-read Game|null $game
 * @property-read GtaServer|null $server
 */
#[Fillable(['user_id', 'game_id', 'gta_server_id', 'provider', 'external_id', 'url', 'embed_url', 'title', 'thumbnail', 'likes_count', 'video_path', 'duration_ms', 'status'])]
class Moment extends Model
{
    public const PROVIDERS = ['youtube' => 'YouTube', 'twitch' => 'Twitch', 'medal' => 'Medal', 'upload' => 'GameCon'];

    /** Найдовший власний кліп, секунд. */
    public const MAX_CLIP_SECONDS = 90;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Game, $this>
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }

    /**
     * @return HasMany<MomentLike, $this>
     */
    public function likes(): HasMany
    {
        return $this->hasMany(MomentLike::class);
    }
}
