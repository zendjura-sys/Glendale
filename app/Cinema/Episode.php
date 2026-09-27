<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;

class Episode extends Model
{
    protected $table = 'cinema_episodes';

    protected $guarded = ['id'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['air_date' => 'date'];
    }
}
