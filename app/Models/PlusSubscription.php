<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Підписка GameCon+, куплена в застосунку через Google Play Billing.
 * Джерело правди — Google Play Developer API (GooglePlay::sync); тут лише останній відомий стан.
 *
 * @property int $id
 * @property string $provider google_play
 * @property string $provider_id sha256 токена покупки
 * @property string $owner_type user
 * @property int $owner_id
 * @property int|null $user_id
 * @property string $product ID підписки в Play Console
 * @property string|null $base_plan
 * @property string $status active | grace | on_hold | paused | canceled | expired | pending
 * @property Carbon|null $renews_at Кінець оплаченого періоду (expiryTime)
 * @property Carbon|null $ends_at Коли доступ закінчився або закінчиться (якщо автопродовження вимкнено)
 * @property string|null $purchase_token
 * @property string|null $order_id
 * @property bool $auto_renew
 * @property bool $is_test
 * @property Carbon|null $acknowledged_at
 * @property Carbon|null $checked_at
 * @property-read User|null $user
 */
#[Fillable(['provider', 'provider_id', 'owner_type', 'owner_id', 'user_id', 'product', 'base_plan', 'status', 'renews_at', 'ends_at', 'purchase_token', 'order_id', 'auto_renew', 'is_test', 'acknowledged_at', 'checked_at'])]
#[Hidden(['purchase_token'])]
class PlusSubscription extends Model
{
    public const GOOGLE_PLAY = 'google_play';

    /** Стани, у яких доступ є. */
    public const ENTITLED = ['active', 'grace', 'canceled'];

    protected function casts(): array
    {
        return [
            'renews_at' => 'datetime',
            'ends_at' => 'datetime',
            'auto_renew' => 'boolean',
            'is_test' => 'boolean',
            'acknowledged_at' => 'datetime',
            'checked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }
}
