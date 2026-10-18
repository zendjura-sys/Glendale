<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Carbon $starts_at
 */
#[Fillable(['clan_id', 'opponent_id', 'starts_at', 'score_home', 'score_away', 'note'])]
class ClanMatch extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<Clan, $this>
     */
    public function clan(): BelongsTo
    {
        return $this->belongsTo(Clan::class, 'clan_id');
    }

    /**
     * @return BelongsTo<Clan, $this>
     */
    public function opponent(): BelongsTo
    {
        return $this->belongsTo(Clan::class, 'opponent_id');
    }
}
