<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Категорія каналів спільноти («Головне», «Ігри», «Голосові»…).
 *
 * @property int $id
 * @property int $community_id
 * @property string $name
 * @property int $position
 * @property Carbon $created_at
 */
#[Fillable(['community_id', 'name', 'position'])]
class CommunityChannelCategory extends Model
{
    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    /**
     * @return HasMany<CommunityChannel, $this>
     */
    public function channels(): HasMany
    {
        return $this->hasMany(CommunityChannel::class, 'category_id');
    }
}
