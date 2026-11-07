<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Звіт гравця про FPS у грі.
 *
 * @property int $id
 * @property int $game_id
 * @property int $user_id
 * @property string $gpu
 * @property string|null $cpu
 * @property string $resolution
 * @property string $preset
 * @property int $fps
 */
#[Fillable(['game_id', 'user_id', 'gpu', 'cpu', 'resolution', 'preset', 'fps'])]
class FpsReport extends Model
{
    public const RESOLUTIONS = ['1080p', '1440p', '4k', 'ultrawide'];

    public const PRESETS = ['low' => 'Низькі', 'medium' => 'Середні', 'high' => 'Високі', 'ultra' => 'Ультра'];
}
