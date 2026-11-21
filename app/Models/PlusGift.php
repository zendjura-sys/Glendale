<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Подарунок GameCon+ другові: листівка з побажанням і датою вручення.
 *
 * @property int $id
 * @property int $payer_id
 * @property int $recipient_id
 * @property string $product
 * @property int $days
 * @property string|null $message
 * @property string $theme
 * @property Carbon|null $deliver_at
 * @property int|null $payment_id
 * @property string $status draft | scheduled | delivered
 * @property Carbon|null $delivered_at
 * @property Carbon|null $seen_at
 * @property Carbon $created_at
 * @property-read User $payer
 * @property-read User $recipient
 */
#[Fillable(['payer_id', 'recipient_id', 'product', 'days', 'message', 'theme', 'deliver_at', 'payment_id', 'status', 'delivered_at', 'seen_at'])]
class PlusGift extends Model
{
    public const THEMES = ['ice', 'neon', 'gold'];

    protected function casts(): array
    {
        return ['deliver_at' => 'datetime', 'delivered_at' => 'datetime', 'seen_at' => 'datetime', 'days' => 'integer'];
    }

    /** @return BelongsTo<User, $this> */
    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    /** @return array<string, mixed> */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'days' => $this->days,
            'message' => $this->message,
            'theme' => $this->theme,
            'status' => $this->status,
            'deliver_at' => $this->deliver_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'payer' => $this->relationLoaded('payer') ? $this->payer?->toCard() : null,
            'recipient' => $this->relationLoaded('recipient') ? $this->recipient?->toCard() : null,
        ];
    }
}
