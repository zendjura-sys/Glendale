<?php

namespace App\Cinema;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Credit extends Model
{
    protected $table = 'cinema_credits';

    protected $guarded = ['id'];

    public $timestamps = false;

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }

    public function title(): BelongsTo
    {
        return $this->belongsTo(Title::class, 'title_id');
    }
}
