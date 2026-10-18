<?php

namespace App\Models;

use App\Services\Phones\PhoneNumbers;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Правка адміністратора для конкретного номера: інший рівень або резерв.
 *
 * @property int $id
 * @property string $operator
 * @property string $digits
 * @property string|null $tier
 * @property bool $reserved
 * @property string|null $note
 */
#[Fillable(['operator', 'digits', 'tier', 'reserved', 'note'])]
class PhoneNumberRule extends Model
{
    protected function casts(): array
    {
        return ['reserved' => 'boolean'];
    }

    /** «(05) 123-45-67» — правка діє для номера в обох мережах. */
    public function formatted(): string
    {
        return PhoneNumbers::local($this->operator, $this->digits);
    }
}
