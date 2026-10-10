<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Голосова кімната сім’ї або спільноти.
 *
 * @property int $id
 * @property string $owner_type
 * @property int $owner_id
 * @property string $name
 * @property int $position
 * @property list<int>|null $ranks
 * @property int|null $template_id
 * @property int|null $created_by
 */
#[Fillable(['owner_type', 'owner_id', 'name', 'position', 'ranks', 'template_id', 'created_by'])]
class VoiceRoom extends Model
{
    public const OWNER_FAMILY = 'family';

    public const OWNER_COMMUNITY = 'community';

    public const OWNER_CLAN = 'clan';

    public const OWNER_SERVER = 'server';

    public const OWNER_PARTY = 'party';

    public const OWNERS = [self::OWNER_FAMILY, self::OWNER_COMMUNITY, self::OWNER_CLAN, self::OWNER_SERVER, self::OWNER_PARTY];

    public const PERMISSION_PREFIX = 'voice.room.';

    /** Скільки кімнат може мати одна сім’я чи спільнота. */
    public const MAX_ROOMS = 10;

    protected function casts(): array
    {
        return ['ranks' => 'array'];
    }

    /**
     * @return BelongsTo<VoiceRoomTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(VoiceRoomTemplate::class, 'template_id');
    }

    /** Ключ у матриці прав сім’ї: доступ до кімнати налаштовується поруч з іншими правами. */
    public function permissionKey(): string
    {
        return self::PERMISSION_PREFIX.$this->id;
    }

    /** Чи відкрита кімната для рангу сім’ї (лідер — завжди). */
    public function allowsRank(int $rank): bool
    {
        return $this->ranks === null || $rank >= Family::LEADER_RANK || in_array($rank, $this->ranks, true);
    }

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
