<?php

namespace App\Models;

use App\Services\Phones\PhoneNumbers;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Внутрішній номер GameCon: +{country} ({operator}) {digits}.
 *
 * @property int $id
 * @property int $user_id
 * @property string $country
 * @property string $operator
 * @property string $digits
 * @property string $tier
 * @property string $kind
 * @property string $status
 * @property Carbon|null $hold_until
 * @property int|null $payment_id
 * @property Carbon $created_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'country', 'operator', 'digits', 'tier', 'kind', 'status', 'hold_until', 'payment_id'])]
class PhoneNumber extends Model
{
    public const ACTIVE = 'active';

    public const PENDING = 'pending';

    public const RANDOM = 'random';

    public const PURCHASED = 'purchased';

    protected function casts(): array
    {
        return ['hold_until' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** «+777 (05) 123-45-67». */
    public function formatted(): string
    {
        return PhoneNumbers::format($this->country, $this->operator, $this->digits);
    }

    /**
     * @return array{number: string, tier: string, kind: string}
     */
    public function toCard(): array
    {
        return ['number' => $this->formatted(), 'tier' => $this->tier, 'kind' => $this->kind];
    }
}
