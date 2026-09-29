<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KodikSource extends Model
{
    protected $table = 'cinema_kodik_sources';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'availability' => 'array',
            'material' => 'array',
            'source_updated_at' => 'datetime',
            'is_available' => 'boolean',
        ];
    }

    public function title(): BelongsTo
    {
        return $this->belongsTo(Title::class, 'title_id');
    }
}
