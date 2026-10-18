<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Рядок журналу рахунку. amount > 0 — зарахування, < 0 — списання; копійки.
 *
 * @property int $id
 * @property int $user_id
 * @property int $amount
 * @property int $balance_after
 * @property string $type topup | purchase | renewal | refund | adjust
 * @property string $description
 * @property string|null $product
 * @property string|null $reference
 * @property int|null $by_user_id
 * @property Carbon $created_at
 * @property-read User $user
 * @property-read User|null $by
 */
#[Fillable(['user_id', 'amount', 'balance_after', 'type', 'description', 'product', 'reference', 'by_user_id'])]
class WalletTransaction extends Model
{
    public const TYPES = ['topup', 'purchase', 'renewal', 'refund', 'adjust'];

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'amount' => $this->amount,
            'balance_after' => $this->balance_after,
            'type' => $this->type,
            'description' => $this->description,
            'product' => $this->product,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function by(): BelongsTo
    {
        return $this->belongsTo(User::class, 'by_user_id');
    }
}
