<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Замовлення, оплачене карткою через еквайринг monobank: один рахунок monobank — один товар.
 * purchase — людина купує сама (сторінка оплати monobank, Google Pay); renewal — автопродовження
 * збереженою карткою без участі людини.
 *
 * @property int $id
 * @property string $code GC-XXXXXX — призначення платежу
 * @property int $user_id Платник
 * @property string $kind purchase | renewal
 * @property string $product
 * @property string $target_type user | family | server
 * @property int $target_id
 * @property bool $renew Увімкнути автопродовження після оплати
 * @property bool $save_card Зберегти картку (токен банку) для автопродовження
 * @property int $price Ціна товару, копійок
 * @property int $credit_used Зараховано зі старого балансу, копійок
 * @property int $amount До списання з картки, копійок
 * @property string $status pending | paid | failed | cancelled | refunded
 * @property string $method card | google_pay | saved_card
 * @property string|null $invoice_id
 * @property string|null $page_url
 * @property string|null $masked_pan
 * @property string|null $failure
 * @property int $refunded Повернуто на картку, копійок
 * @property int $discount Знижка за промокодом, копійок
 * @property int|null $promo_redemption_id
 * @property int|null $payment_id
 * @property int|null $renewal_id
 * @property int|null $card_id
 * @property Carbon $expires_at
 * @property Carbon|null $paid_at
 * @property Carbon $created_at
 * @property-read User $user
 * @property-read PlusPayment|null $payment
 */
#[Fillable(['code', 'user_id', 'kind', 'product', 'target_type', 'target_id', 'renew', 'save_card', 'price', 'credit_used', 'amount', 'status', 'method', 'invoice_id', 'page_url', 'masked_pan', 'failure', 'refunded', 'discount', 'promo_redemption_id', 'payment_id', 'renewal_id', 'card_id', 'expires_at', 'paid_at'])]
class PaymentOrder extends Model
{
    public const PENDING = 'pending';

    public const PAID = 'paid';

    public const FAILED = 'failed';

    public const CANCELLED = 'cancelled';

    public const REFUNDED = 'refunded';

    protected function casts(): array
    {
        return [
            'renew' => 'boolean',
            'save_card' => 'boolean',
            'expires_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function open(): bool
    {
        return $this->status === self::PENDING && $this->expires_at->isFuture();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'kind' => $this->kind,
            'product' => $this->product,
            'price' => $this->price,
            'amount' => $this->amount,
            'credit_used' => $this->credit_used,
            'discount' => $this->discount,
            'status' => $this->status === self::PENDING && ! $this->open() ? 'expired' : $this->status,
            'method' => $this->method,
            'masked_pan' => $this->masked_pan,
            'failure' => $this->failure,
            'refunded' => $this->refunded,
            'page_url' => $this->open() ? $this->page_url : null,
            'created_at' => $this->created_at->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
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
     * @return BelongsTo<PlusPayment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(PlusPayment::class);
    }
}
