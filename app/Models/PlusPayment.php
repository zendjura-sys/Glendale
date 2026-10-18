<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $provider
 * @property string $provider_id
 * @property int|null $user_id
 * @property string $product
 * @property string|null $target_type user | family | server
 * @property int|null $target_id
 * @property int $amount У копійках/центах валюти магазину
 * @property string $currency
 * @property string $status paid | refunded
 * @property string|null $receipt_url
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['provider', 'provider_id', 'user_id', 'product', 'target_type', 'target_id', 'amount', 'currency', 'status', 'receipt_url'])]
class PlusPayment extends Model
{
    public const PAID = 'paid';

    public const REFUNDED = 'refunded';

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
