<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Person extends Model
{
    protected $table = 'cinema_people';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['birthday' => 'date', 'deathday' => 'date', 'details_loaded_at' => 'datetime'];
    }

    public function credits(): HasMany
    {
        return $this->hasMany(Credit::class, 'person_id');
    }
}
