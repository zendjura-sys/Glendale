<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Варіант часу в голосуванні паті.
 *
 * @property int $id
 * @property int $party_post_id
 * @property Carbon $starts_at
 * @property-read PartyPost $party
 */
#[Fillable(['party_post_id', 'starts_at'])]
class PartyTimeSlot extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['starts_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<PartyPost, $this>
     */
    public function party(): BelongsTo
    {
        return $this->belongsTo(PartyPost::class, 'party_post_id');
    }

    /**
     * Хто позначив «мені підходить».
     *
     * @return BelongsToMany<User, $this>
     */
    public function voters(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'party_time_votes')->withPivot('created_at');
    }
}
