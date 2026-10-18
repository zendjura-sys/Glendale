<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Заявка на поповнення рахунку донатом: людина вказує код у повідомленні до донату.
 *
 * @property int $id
 * @property string $code GC-XXXXXX
 * @property int $user_id
 * @property int $amount Сума, яку людина збирається задонатити, ₴
 * @property string|null $method Спосіб, яким людина каже, що заплатила
 * @property string $status pending | paid | cancelled
 * @property Carbon|null $claimed_at Людина натиснула «Я оплатив»
 * @property string|null $note Коментар людини (ім’я в донаті, час)
 * @property int|null $credited Скільки зараховано, копійок
 * @property int|null $donation_id
 * @property int|null $confirmed_by
 * @property Carbon|null $paid_at
 * @property Carbon $expires_at
 * @property Carbon $created_at
 * @property-read User $user
 * @property-read PlusDonation|null $donation
 * @property-read User|null $confirmer
 */
#[Fillable(['code', 'user_id', 'amount', 'method', 'status', 'claimed_at', 'note', 'credited', 'donation_id', 'confirmed_by', 'paid_at', 'expires_at'])]
class WalletTopup extends Model
{
    public const PENDING = 'pending';

    public const PAID = 'paid';

    public const CANCELLED = 'cancelled';

    protected function casts(): array
    {
        return [
            'claimed_at' => 'datetime',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /** Чекає оплати. Заявлене («Я оплатив») не згорає — його перевіряє адміністратор. */
    public function open(): bool
    {
        return $this->status === self::PENDING && ($this->claimed_at !== null || $this->expires_at->isFuture());
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'amount' => $this->amount,
            'method' => $this->method,
            'status' => $this->open() || $this->status !== self::PENDING ? $this->status : 'expired',
            'claimed' => $this->claimed_at !== null,
            'credited' => $this->credited,
            'expires_at' => $this->expires_at->toIso8601String(),
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
     * @return BelongsTo<PlusDonation, $this>
     */
    public function donation(): BelongsTo
    {
        return $this->belongsTo(PlusDonation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
