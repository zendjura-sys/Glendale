<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Сезонна подія сайту.
 *
 * @property int $id
 * @property string $slug
 * @property string $title
 * @property string|null $description
 * @property string $theme none | newyear | valentine | easter | independence | halloween
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property list<array{metric: string, target: int}> $tasks
 * @property string|null $goal_metric
 * @property int|null $goal_target
 * @property list<array{type: string, value: string}> $reward Косметика з config/season_pass.php
 * @property int|null $created_by
 */
#[Fillable(['slug', 'title', 'description', 'theme', 'starts_at', 'ends_at', 'tasks', 'goal_metric', 'goal_target', 'reward', 'created_by'])]
class SiteEvent extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'tasks' => 'array', 'reward' => 'array', 'goal_target' => 'integer'];
    }

    public function isActive(): bool
    {
        return $this->starts_at->isPast() && $this->ends_at->isFuture();
    }
}
