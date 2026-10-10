<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property int $days
 * @property int $max_uses
 * @property int $uses
 * @property Carbon|null $expires_at
 * @property int|null $created_by
 * @property Carbon $created_at
 */
#[Fillable(['code', 'days', 'max_uses', 'uses', 'expires_at', 'created_by'])]
class PlusCode extends Model
{
    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    /**
     * @return HasMany<PlusCodeRedemption, $this>
     */
    public function redemptions(): HasMany
    {
        return $this->hasMany(PlusCodeRedemption::class);
    }

    public function usable(): bool
    {
        return $this->uses < $this->max_uses && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
