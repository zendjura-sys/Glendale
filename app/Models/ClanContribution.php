<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Внесок у скарбницю клану (додатний) або витрата (від’ємна). Внесок підтверджує скарбник.
 *
 * @property int $id
 * @property int $clan_id
 * @property int|null $user_id
 * @property int $amount
 * @property string|null $comment
 * @property string $status
 * @property int|null $reviewed_by
 * @property Carbon $created_at
 */
#[Fillable(['clan_id', 'user_id', 'amount', 'comment', 'status', 'reviewed_by'])]
class ClanContribution extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    protected function casts(): array
    {
        return ['amount' => 'integer'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
