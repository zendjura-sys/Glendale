<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Завершений сезон рейтингу сім’ї з десяткою найкращих.
 *
 * @property int $id
 * @property int $family_id
 * @property int $number
 * @property Carbon|null $started_at
 * @property Carbon $ended_at
 * @property list<array{place: int, name: string, points: int}> $top
 */
#[Fillable(['family_id', 'number', 'started_at', 'ended_at', 'top'])]
class FamilySeason extends Model
{
    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ended_at' => 'datetime', 'top' => 'array'];
    }
}
