<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $gta_server_id
 * @property string $kind top | highlight | banner
 * @property int|null $user_id
 * @property int|null $payment_id
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property-read GtaServer $server
 */
#[Fillable(['gta_server_id', 'kind', 'user_id', 'payment_id', 'starts_at', 'ends_at'])]
class ServerPromotion extends Model
{
    public const KINDS = ['top', 'highlight', 'banner'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /**
     * @param  Builder<ServerPromotion>  $query
     */
    public function scopeLive(Builder $query): void
    {
        $query->where('starts_at', '<=', now())->where('ends_at', '>', now());
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }
}
