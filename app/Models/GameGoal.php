<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Особиста ціль у грі («Дійти до Діаманту», «100 перемог»).
 *
 * @property int $id
 * @property int $user_id
 * @property int $game_id
 * @property string $title
 * @property int|null $target
 * @property int $progress
 * @property CarbonInterface|null $done_at
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'game_id', 'title', 'target', 'progress', 'done_at'])]
class GameGoal extends Model
{
    protected function casts(): array
    {
        return ['done_at' => 'datetime'];
    }
}
