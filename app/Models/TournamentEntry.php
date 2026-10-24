<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Учасник турніру: гравець або сім’я (тоді user_id — хто її зареєстрував).
 *
 * @property int $id
 * @property int $tournament_id
 * @property int $user_id
 * @property int|null $family_id
 * @property int|null $seed
 * @property-read User $user
 * @property-read Family|null $family
 */
#[Fillable(['tournament_id', 'user_id', 'family_id', 'seed'])]
class TournamentEntry extends Model
{
    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Family, $this>
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /**
     * @return array{id: int, name: string, avatar: string|null, url: string, family: bool}
     */
    public function toCard(): array
    {
        if ($this->family) {
            return ['id' => $this->id, 'name' => $this->family->name, 'avatar' => $this->family->logo_url, 'url' => '/f/'.$this->family->slug, 'family' => true];
        }

        return ['id' => $this->id, 'name' => $this->user->name, 'avatar' => $this->user->avatar_url, 'url' => '/'.$this->user->username, 'family' => false];
    }
}
