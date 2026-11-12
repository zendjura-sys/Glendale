<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Зміна чи чергування в клані/гільдії. Без учасника — вільна.
 *
 * @property int $id
 * @property int $clan_id
 * @property string $title
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property int|null $user_id
 * @property int|null $created_by
 * @property-read User|null $user
 */
#[Fillable(['clan_id', 'title', 'starts_at', 'ends_at', 'user_id', 'created_by'])]
class ClanShift extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
