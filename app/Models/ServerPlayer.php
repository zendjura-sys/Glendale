<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Гравець, якого сервер підтвердив через «Увійти через GameCon».
 *
 * @property int $id
 * @property int $gta_server_id
 * @property int $user_id
 * @property string|null $nickname
 * @property bool $online
 * @property Carbon $verified_at
 * @property Carbon|null $last_seen_at
 * @property-read GtaServer $server
 * @property-read User $user
 */
#[Fillable(['gta_server_id', 'user_id', 'nickname', 'online', 'verified_at', 'last_seen_at'])]
class ServerPlayer extends Model
{
    protected function casts(): array
    {
        return ['online' => 'boolean', 'verified_at' => 'datetime', 'last_seen_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
