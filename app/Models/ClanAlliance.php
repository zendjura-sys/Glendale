<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['clan_id', 'ally_id', 'status'])]
class ClanAlliance extends Model
{
    public const PENDING = 'pending';

    public const ACCEPTED = 'accepted';

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
    public function ally(): BelongsTo
    {
        return $this->belongsTo(Clan::class, 'ally_id');
    }
}
