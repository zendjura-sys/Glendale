<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $owner_type user | family
 * @property int $owner_id
 * @property string $source purchase | renewal | gift | code | admin | subscription (Google Play)
 * @property int|null $subscription_id
 * @property int|null $payment_id
 * @property int|null $by_user_id
 * @property string|null $note
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property Carbon $created_at
 * @property-read User|null $by
 */
#[Fillable(['owner_type', 'owner_id', 'source', 'subscription_id', 'payment_id', 'by_user_id', 'note', 'starts_at', 'ends_at'])]
class PlusGrant extends Model
{
    public const SOURCES = ['purchase', 'renewal', 'subscription', 'gift', 'code', 'admin'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function by(): BelongsTo
    {
        return $this->belongsTo(User::class, 'by_user_id');
    }
}
