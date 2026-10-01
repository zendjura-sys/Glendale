<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_id
 * @property int $member_id
 * @property int $amount
 * @property string $period
 * @property int $periods
 * @property int $rate_bp
 * @property int $payout
 * @property string $status
 * @property Carbon $matures_at
 * @property Carbon|null $closed_at
 * @property int|null $paid
 * @property Carbon $created_at
 * @property-read FamilyMember $member
 * @property-read Family $family
 */
#[Fillable(['family_id', 'member_id', 'amount', 'period', 'periods', 'rate_bp', 'payout', 'status', 'matures_at', 'closed_at', 'paid'])]
class FamilyDeposit extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_MATURED = 'matured';

    public const STATUS_CLOSED = 'closed';

    public const PERIODS = ['daily' => 'Щоденний', 'weekly' => 'Щотижневий'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'payout' => 'integer',
            'paid' => 'integer',
            'matures_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }

    /**
     * @return BelongsTo<Family, $this>
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /**
     * Нараховані відсотки на поточний момент (прогрес до дати виплати).
     */
    public function accrued(): int
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return max(0, (int) $this->paid - $this->amount);
        }

        $total = $this->matures_at->diffInSeconds($this->created_at, true);
        $done = min($total, now()->diffInSeconds($this->created_at, true));

        return $total > 0 ? (int) floor(($this->payout - $this->amount) * $done / $total) : 0;
    }
}
