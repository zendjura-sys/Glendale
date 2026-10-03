<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Голосова кімната сім’ї або спільноти.
 *
 * @property int $id
 * @property string $owner_type
 * @property int $owner_id
 * @property string $name
 * @property int $position
 * @property int|null $created_by
 */
#[Fillable(['owner_type', 'owner_id', 'name', 'position', 'created_by'])]
class VoiceRoom extends Model
{
    public const OWNER_FAMILY = 'family';

    public const OWNER_COMMUNITY = 'community';

    public const OWNERS = [self::OWNER_FAMILY, self::OWNER_COMMUNITY];

    /** Скільки кімнат може мати одна сім’я чи спільнота. */
    public const MAX_ROOMS = 10;

    /**
     * @return HasMany<VoiceParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(VoiceParticipant::class);
    }

    /** Назва кімнати в LiveKit — незмінна, на відміну від назви для людей. */
    public function livekitName(): string
    {
        return 'gc-'.$this->id;
    }

    public static function idFromLivekit(string $name): ?int
    {
        return preg_match('/^gc-(\d+)$/', $name, $m) === 1 ? (int) $m[1] : null;
    }
}
