<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Подія сервера GTA: офіційна (від адміністрації GameCon) або від сім’ї цього сервера.
 *
 * @property int $id
 * @property int $gta_server_id
 * @property int|null $user_id
 * @property int|null $family_id
 * @property string $title
 * @property string $type
 * @property string|null $description
 * @property Carbon $starts_at
 * @property bool $is_official
 * @property Carbon|null $reminded_at
 * @property string $source
 * @property string|null $external_id
 * @property Carbon|null $ends_at
 * @property string|null $url
 * @property-read GtaServer|null $server
 * @property-read Family|null $family
 * @property-read User|null $user
 */
#[Fillable(['gta_server_id', 'user_id', 'family_id', 'title', 'type', 'description', 'starts_at', 'is_official', 'reminded_at', 'source', 'external_id', 'ends_at', 'url', 'repeat', 'spawned_at'])]
class ServerEvent extends Model
{
    public const TYPES = [
        'tournament' => 'Турнір',
        'event' => 'Захід',
        'meeting' => 'Збір',
        'raid' => 'Рейд',
        'other' => 'Інше',
    ];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'reminded_at' => 'datetime', 'spawned_at' => 'datetime', 'is_official' => 'boolean'];
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }

    /**
     * @return BelongsTo<Family, $this>
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<ServerEventRsvp, $this>
     */
    public function rsvps(): HasMany
    {
        return $this->hasMany(ServerEventRsvp::class);
    }
}
