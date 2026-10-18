<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int $gta_server_id
 * @property string $voted_on Дата голосу, Y-m-d (рядок — щоб порівняння однаково працювали в SQLite і MySQL).
 * @property Carbon|null $created_at
 */
#[Fillable(['user_id', 'gta_server_id', 'voted_on'])]
class ServerVote extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }
}
