<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Season extends Model
{
    protected $table = 'cinema_seasons';

    protected $guarded = ['id'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['air_date' => 'date', 'episodes_loaded_at' => 'datetime'];
    }

    public function episodes(): HasMany
    {
        return $this->hasMany(Episode::class, 'season_id')->orderBy('number');
    }
}
