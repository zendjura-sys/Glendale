<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Журнал дій керівництва клану.
 *
 * @property int $id
 * @property int $clan_id
 * @property int|null $actor_id
 * @property string $action
 * @property string $text
 * @property Carbon $created_at
 */
#[Fillable(['clan_id', 'actor_id', 'action', 'text', 'created_at'])]
class ClanLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
