<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Кімната, яку адміністрація сайту додає в кожну сім’ю (наприклад, «Бізвар»).
 * Ранги — доступ за замовчуванням; далі кожна сім’я змінює його у своїх правах.
 *
 * @property int $id
 * @property string $name
 * @property list<int>|null $ranks
 * @property int $position
 */
#[Fillable(['name', 'ranks', 'position'])]
class VoiceRoomTemplate extends Model
{
    protected function casts(): array
    {
        return ['ranks' => 'array'];
    }

    /**
     * @return HasMany<VoiceRoom, $this>
     */
    public function rooms(): HasMany
    {
        return $this->hasMany(VoiceRoom::class, 'template_id');
    }

    /**
     * Ранги 1–9 без повторів; усі дев’ять — те саме, що «відкрита для всіх» (null).
     *
     * @param  array<int, mixed>|null  $ranks
     * @return list<int>|null
     */
    public static function normalizeRanks(?array $ranks): ?array
    {
        if ($ranks === null) {
            return null;
        }
        $ranks = array_values(array_unique(array_filter(array_map('intval', $ranks), fn (int $r) => $r >= 1 && $r <= 9)));
        sort($ranks);

        return count($ranks) === 9 ? null : $ranks;
    }
}
