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
 * @property string $owner_type user | family
 * @property int $owner_id
 * @property int|null $user_id Хто платить
 * @property string $product
 * @property string $status on_trial | active | paused | past_due | unpaid | cancelled | expired
 * @property Carbon|null $renews_at
 * @property Carbon|null $ends_at
 * @property string|null $portal_url
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['provider', 'provider_id', 'owner_type', 'owner_id', 'user_id', 'product', 'status', 'renews_at', 'ends_at', 'portal_url'])]
class PlusSubscription extends Model
{
    /** Статуси, за яких доступ триває до дати продовження. */
    public const RUNNING = ['on_trial', 'active', 'past_due'];

    protected function casts(): array
    {
        return ['renews_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
