<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Подія гри: шоукейс чи трансляція (IGDB), вихід гри, турнір або офіційна подія GameCon.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $title
 * @property string $type
 * @property string|null $description
 * @property Carbon $starts_at
 * @property Carbon|null $ends_at
 * @property bool $all_day
 * @property string|null $url
 * @property string|null $image
 * @property string $source
 * @property string|null $external_id
 * @property Carbon|null $reminded_at
 * @property-read Collection<int, Game> $games
 * @property-read Collection<int, GameEventRsvp> $rsvps
 */
#[Fillable(['user_id', 'title', 'type', 'description', 'starts_at', 'ends_at', 'all_day', 'url', 'image', 'source', 'external_id', 'reminded_at'])]
class GameEvent extends Model
{
    public const TYPES = [
        'showcase' => 'Шоукейс',
        'release' => 'Вихід гри',
        'tournament' => 'Турнір',
        'stream' => 'Трансляція',
        'update' => 'Оновлення',
        'event' => 'Подія',
    ];

    /** Джерела: вручну (адміністрація), IGDB (події й дати виходу). */
    public const SOURCES = ['manual' => 'GameCon', 'igdb' => 'IGDB'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'reminded_at' => 'datetime', 'all_day' => 'boolean'];
    }

    /**
     * @return BelongsToMany<Game, $this>
     */
    public function games(): BelongsToMany
    {
        return $this->belongsToMany(Game::class, 'game_event_game');
    }

    /**
     * @return HasMany<GameEventRsvp, $this>
     */
    public function rsvps(): HasMany
    {
        return $this->hasMany(GameEventRsvp::class);
    }
}
