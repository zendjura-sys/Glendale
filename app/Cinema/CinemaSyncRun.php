<?php

namespace App\Cinema;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CinemaSyncRun extends Model
{
    protected $table = 'cinema_sync_runs';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'counters' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function events(): HasMany
    {
        return $this->hasMany(CinemaSyncEvent::class, 'run_id')->latest('id');
    }

    public function initiatorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }
}
