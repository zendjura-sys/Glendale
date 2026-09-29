<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CinemaSyncEvent extends Model
{
    protected $table = 'cinema_sync_events';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'identifiers' => 'array',
            'context' => 'array',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CinemaSyncRun::class, 'run_id');
    }

    public function title(): BelongsTo
    {
        return $this->belongsTo(Title::class, 'title_id');
    }
}
