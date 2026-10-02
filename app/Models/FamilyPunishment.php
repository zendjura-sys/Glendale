<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_id
 * @property int $member_id
 * @property int|null $issuer_id
 * @property string $type
 * @property string $reason
 * @property int|null $amount
 * @property Carbon|null $expires_at
 * @property bool $is_auto
 * @property Carbon|null $revoked_at
 * @property int|null $revoked_by
 * @property string|null $revoke_reason
 * @property Carbon $created_at
 * @property-read FamilyMember $member
 * @property-read FamilyMember|null $issuer
 */
#[Fillable(['family_id', 'member_id', 'issuer_id', 'type', 'reason', 'amount', 'expires_at', 'is_auto', 'revoked_at', 'revoked_by', 'revoke_reason'])]
class FamilyPunishment extends Model
{
    public const TYPE_WARN = 'warn';

    public const TYPE_REPRIMAND = 'reprimand';

    public const TYPE_FINE = 'fine';

    public const TYPE_KICK = 'kick';

    public const TYPES = [
        self::TYPE_WARN => 'Попередження',
        self::TYPE_REPRIMAND => 'Догана',
        self::TYPE_FINE => 'Штраф',
        self::TYPE_KICK => 'Виключення',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'is_auto' => 'boolean',
        ];
    }

    /**
     * @param  Builder<FamilyPunishment>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('revoked_at')->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function issuer(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'issuer_id');
    }
}
