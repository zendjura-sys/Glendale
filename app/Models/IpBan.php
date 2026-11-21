<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Бан за IP-адресою чи підмережею (ip) або гостя за відбитком IP (ip_hash).
 * community_id — бан діє лише в гостьовому чаті цієї спільноти.
 *
 * @property int $id
 * @property string|null $ip
 * @property string|null $ip_hash
 * @property int|null $community_id
 * @property string|null $label
 * @property string|null $reason
 * @property CarbonInterface|null $expires_at
 * @property int|null $created_by
 * @property CarbonInterface $created_at
 */
class IpBan extends Model
{
    protected $fillable = ['ip', 'ip_hash', 'community_id', 'label', 'reason', 'expires_at', 'created_by'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    /** @param  Builder<IpBan>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<Community, $this> */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }
}
