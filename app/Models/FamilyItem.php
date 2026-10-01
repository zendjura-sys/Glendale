<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $family_id
 * @property string $category
 * @property string $name
 * @property string $unit
 * @property int $quantity
 * @property int|null $hourly_quota
 * @property int|null $min_stock
 * @property int $position
 * @property bool $is_archived
 */
#[Fillable(['family_id', 'category', 'name', 'unit', 'quantity', 'hourly_quota', 'min_stock', 'position', 'is_archived'])]
class FamilyItem extends Model
{
    public const CATEGORIES = [
        'armor' => 'Бронежилети',
        'ammo' => 'Набої',
        'meds' => 'Аптечки',
        'weapons' => 'Зброя',
        'other' => 'Інше',
    ];

    /** Стартовий набір складу нової сім’ї. */
    public const STARTER = [
        ['armor', 'Бронежилет', 'шт', 5],
        ['ammo', 'Набої 9 мм', 'шт', 120],
        ['ammo', 'Набої 5.56 мм', 'шт', 120],
        ['ammo', 'Набої 7.62 мм', 'шт', 90],
        ['ammo', 'Набої 12 калібру', 'шт', 60],
        ['meds', 'Аптечка', 'шт', 10],
        ['weapons', 'Пістолет', 'шт', 2],
        ['weapons', 'Карабін', 'шт', 1],
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'is_archived' => 'boolean'];
    }

    /**
     * @return BelongsTo<Family, $this>
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /**
     * @return HasMany<FamilyItemLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(FamilyItemLog::class, 'item_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'name' => $this->name,
            'unit' => $this->unit,
            'quantity' => $this->quantity,
            'hourly_quota' => $this->hourly_quota,
            'min_stock' => $this->min_stock,
            'low' => $this->min_stock !== null && $this->quantity <= $this->min_stock,
            'is_archived' => $this->is_archived,
        ];
    }
}
