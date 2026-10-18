<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Пропозиція номера другові: подарунок (оплатив дарувальник) або передача свого купленого.
 *
 * @property int $id
 * @property int $phone_number_id
 * @property int $from_user_id
 * @property int $to_user_id
 * @property string $kind
 * @property string $status
 * @property Carbon $created_at
 * @property-read PhoneNumber $number
 * @property-read User $from
 * @property-read User $to
 */
#[Fillable(['phone_number_id', 'from_user_id', 'to_user_id', 'kind', 'status'])]
class PhoneOffer extends Model
{
    public const GIFT = 'gift';

    public const TRANSFER = 'transfer';

    public const PENDING = 'pending';

    /**
     * @return BelongsTo<PhoneNumber, $this>
     */
    public function number(): BelongsTo
    {
        return $this->belongsTo(PhoneNumber::class, 'phone_number_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function from(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function to(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'phone' => $this->number->toCard(),
            'from' => $this->from->toCard(),
            'to' => $this->to->toCard(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
