<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $key
 * @property bool $enabled
 * @property array<string, mixed>|null $settings
 * @property int $position
 */
#[Fillable(['key', 'enabled', 'settings', 'position'])]
class Module extends Model
{
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'settings' => 'array',
        ];
    }
}
