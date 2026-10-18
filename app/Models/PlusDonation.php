<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Донат, отриманий через API сервісу (Donatello). topup_id — поповнення, яке він оплатив.
 *
 * @property int $id
 * @property string $provider
 * @property string $external_id
 * @property string|null $name
 * @property string|null $message
 * @property int $amount
 * @property string $currency
 * @property Carbon|null $donated_at
 * @property int|null $topup_id
 * @property Carbon $created_at
 */
#[Fillable(['provider', 'external_id', 'name', 'message', 'amount', 'currency', 'donated_at', 'topup_id'])]
class PlusDonation extends Model
{
    protected function casts(): array
    {
        return ['donated_at' => 'datetime'];
    }
}
