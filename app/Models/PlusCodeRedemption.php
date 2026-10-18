<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $plus_code_id
 * @property int $user_id
 * @property int|null $payments_left Залишилось оплат зі знижкою (null — без обмеження)
 * @property int $applied Скільки разів знижку вже застосовано
 * @property string|null $product Тариф, для якого активовано пробний період
 * @property-read PlusCode $code
 */
#[Fillable(['plus_code_id', 'user_id', 'payments_left', 'applied', 'product'])]
class PlusCodeRedemption extends Model
{
    /**
     * @return BelongsTo<PlusCode, $this>
     */
    public function code(): BelongsTo
    {
        return $this->belongsTo(PlusCode::class, 'plus_code_id');
    }
}
