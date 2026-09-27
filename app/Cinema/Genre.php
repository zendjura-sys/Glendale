<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;

class Genre extends Model
{
    protected $table = 'cinema_genres';

    protected $guarded = ['id'];

    public $timestamps = false;
}
