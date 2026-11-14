<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Банер з A/B-тестом: draft → running → stopped. Переможець лишається єдиним варіантом.
 *
 * @property int $id
 * @property string $name
 * @property string $placement feed
 * @property string $status draft|running|stopped
 * @property int|null $winner_id
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property Carbon $created_at
 * @property-read Collection<int, PromoBannerVariant> $variants
 */
#[Fillable(['name', 'placement', 'status', 'winner_id', 'starts_at', 'ends_at'])]
class PromoBanner extends Model
{
    public const PLACEMENTS = ['feed' => 'Стрічка (над записами)'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return HasMany<PromoBannerVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(PromoBannerVariant::class)->orderBy('label');
    }
}
