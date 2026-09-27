<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;

class Video extends Model
{
    protected $table = 'cinema_videos';

    protected $guarded = ['id'];

    public $timestamps = false;
}
