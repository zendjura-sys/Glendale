<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Збережена картка (токен еквайрингу monobank) для автопродовження. Номер картки не зберігається —
 * лише маска (4444 11** **** 1234) і токен банку, зашифрований ключем застосунку.
 *
 * @property int $id
 * @property int $user_id
 * @property string $provider
 * @property string $token Токен картки (зашифрований)
 * @property string $token_hash sha256 токена — щоб не зберегти ту саму картку двічі
 * @property string $masked_pan
 * @property string|null $payment_system visa | mastercard
 * @property string|null $country
 * @property Carbon|null $last_used_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'provider', 'token', 'token_hash', 'masked_pan', 'payment_system', 'country', 'last_used_at'])]
#[Hidden(['token', 'token_hash'])]
class PaymentCard extends Model
{
    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'last_used_at' => 'datetime',
        ];
    }

    /**
     * @return array{id: int, masked_pan: string, payment_system: string|null}
     */
    public function toCard(): array
    {
        return ['id' => $this->id, 'masked_pan' => $this->masked_pan, 'payment_system' => $this->payment_system];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
