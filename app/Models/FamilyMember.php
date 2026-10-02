<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_id
 * @property int $user_id
 * @property string $rp_nickname
 * @property string $static_id
 * @property int $rank
 * @property string|null $duties
 * @property int $balance
 * @property string $status
 * @property string|null $application_note
 * @property Carbon|null $joined_at
 * @property Carbon|null $left_at
 * @property Carbon $created_at
 * @property-read Family $family
 * @property-read User $user
 */
#[Fillable(['family_id', 'user_id', 'rp_nickname', 'static_id', 'rank', 'duties', 'status', 'application_note', 'joined_at', 'left_at'])]
class FamilyMember extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_LEFT = 'left';

    public const STATUS_KICKED = 'kicked';

    public const STATUS_DECLINED = 'declined';

    /** Ім’я_Прізвище латиницею, як на GTA RP серверах. */
    public const NICKNAME_PATTERN = '/^[A-Z][a-z]+_[A-Z][a-z]+$/';

    protected function casts(): array
    {
        return [
            'rank' => 'integer',
            'balance' => 'integer',
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
        ];
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
     * @return HasMany<FamilyPunishment, $this>
     */
    public function punishments(): HasMany
    {
        return $this->hasMany(FamilyPunishment::class, 'member_id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isLeader(): bool
    {
        return $this->rank >= Family::LEADER_RANK;
    }

    /**
     * «Marco_Scaletta [12345]» — так учасника показують скрізь у сім’ї.
     */
    public function displayName(): string
    {
        return "{$this->rp_nickname} [{$this->static_id}]";
    }

    /**
     * Чи може учасник керувати іншим: ранг строго вищий, а власник сім’ї керує всіма, крім себе.
     */
    public function outranks(FamilyMember $other, Family $family): bool
    {
        if ($this->id === $other->id || $other->user_id === $family->owner_id) {
            return false;
        }

        return $this->rank > $other->rank || $this->user_id === $family->owner_id;
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(?Family $family = null): array
    {
        $family ??= $this->relationLoaded('family') ? $this->family : null;

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'nickname' => $this->rp_nickname,
            'static_id' => $this->static_id,
            'display' => $this->displayName(),
            'rank' => $this->rank,
            'rank_title' => $family?->rankTitle($this->rank),
            'duties' => $this->duties,
            'avatar_url' => $this->relationLoaded('user') ? $this->user->avatar_url : null,
            'username' => $this->relationLoaded('user') ? $this->user->username : null,
            'is_online' => $this->relationLoaded('user') && $this->user->is_online,
            'discord' => $this->relationLoaded('user') ? $this->user->discord_username : null,
        ];
    }
}
