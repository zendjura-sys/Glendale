<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Оголошення «Шукаю пату»: гра або сервер, час, ролі й місця; у кожної пати — своя голосова кімната.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $game_id
 * @property int|null $gta_server_id
 * @property string $title
 * @property string|null $note
 * @property string|null $platform
 * @property list<string>|null $roles
 * @property int $slots
 * @property Carbon|null $starts_at
 * @property Carbon $expires_at
 * @property Carbon|null $closed_at
 * @property Carbon $created_at
 * @property-read User $user
 * @property-read Game|null $game
 * @property-read GtaServer|null $server
 * @property-read Collection<int, PartyMember> $members
 */
#[Fillable(['user_id', 'game_id', 'gta_server_id', 'title', 'note', 'platform', 'roles', 'slots', 'starts_at', 'expires_at', 'closed_at'])]
class PartyPost extends Model
{
    public const PLATFORMS = ['pc' => 'ПК', 'playstation' => 'PlayStation', 'xbox' => 'Xbox', 'switch' => 'Switch', 'mobile' => 'Мобільні'];

    protected function casts(): array
    {
        return ['roles' => 'array', 'starts_at' => 'datetime', 'expires_at' => 'datetime', 'closed_at' => 'datetime', 'slots' => 'integer'];
    }

    /**
     * @param  Builder<PartyPost>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereNull('closed_at')->where('expires_at', '>', now());
    }

    public function isOpen(): bool
    {
        return $this->closed_at === null && $this->expires_at->isFuture();
    }

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
     * @return HasMany<PartyMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(PartyMember::class);
    }

    /** Учасник пати — автор або той, хто приєднався. */
    public function hasMember(User $user): bool
    {
        return $this->user_id === $user->id || $this->members->contains('user_id', $user->id);
    }
}
