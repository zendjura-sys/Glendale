<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Гра в беклозі людини: хочу пограти, граю, пройшов, кинув.
 *
 * @property int $user_id
 * @property int $game_id
 * @property string $status
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Game $game
 * @property-read User $user
 */
#[Fillable(['user_id', 'game_id', 'status'])]
class GameBacklog extends Model
{
    public const WANT = 'want';

    public const PLAYING = 'playing';

    public const DONE = 'done';

    public const DROPPED = 'dropped';

    /** Стани в порядку колонок дошки. */
    public const STATUSES = [self::WANT, self::PLAYING, self::DONE, self::DROPPED];

    protected $table = 'game_backlog';

    public $incrementing = false;

    protected $primaryKey = null;

    /**
     * Ключ — пара (людина, гра): оновлення й видалення працюють за обома полями.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query): Builder
    {
        return $query->where('user_id', $this->getAttribute('user_id'))->where('game_id', $this->getAttribute('game_id'));
    }

    /**
     * @return BelongsTo<Game, $this>
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
