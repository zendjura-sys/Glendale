<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property int $days
 * @property int $max_uses
 * @property int $uses
 * @property Carbon|null $expires_at
 * @property int|null $created_by
 * @property string $type days | discount | first_payment | trial
 * @property int $months Безкоштовний період у місяцях (trial)
 * @property int|null $percent Знижка у відсотках
 * @property int|null $amount_off Знижка сумою, ₴
 * @property int|null $payments Скільки оплат зі знижкою (null — усі)
 * @property list<string>|null $products Тарифи, на які діє (null — усі підписки)
 * @property bool $new_only Лише для тих, хто ще не платив
 * @property string|null $note Примітка адміністратора
 * @property Carbon $created_at
 */
#[Fillable(['code', 'days', 'max_uses', 'uses', 'expires_at', 'created_by', 'type', 'months', 'percent', 'amount_off', 'payments', 'products', 'new_only', 'note'])]
class PlusCode extends Model
{
    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'products' => 'array', 'new_only' => 'boolean'];
    }

    /**
     * @return HasMany<PlusCodeRedemption, $this>
     */
    public function redemptions(): HasMany
    {
        return $this->hasMany(PlusCodeRedemption::class);
    }

    public function usable(): bool
    {
        return $this->uses < $this->max_uses && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
