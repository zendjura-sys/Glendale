<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Автопродовження GameCon+ з рахунку: за добу до кінця періоду списується ціна товару.
 * Власник — людина (особистий GameCon+) або сім’я, платник — user_id.
 *
 * @property int $id
 * @property int $user_id
 * @property string $product plus_month | plus_year | family_month | family_year
 * @property string $owner_type user | family
 * @property int $owner_id
 * @property bool $active
 * @property Carbon|null $renewed_at
 * @property Carbon|null $failed_at Остання невдала спроба (не вистачило коштів)
 * @property-read User $user
 */
#[Fillable(['user_id', 'product', 'owner_type', 'owner_id', 'active', 'renewed_at', 'failed_at'])]
class PlusRenewal extends Model
{
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'renewed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
