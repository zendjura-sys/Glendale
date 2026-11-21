<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Сезон пропуску (календарний місяць).
 *
 * @property int $id
 * @property string $key Y-m
 * @property string $title Назва теми сезону
 * @property string $theme Ключ теми з config/season_pass.php
 * @property array<int, int>|null $levels Очок на кожен рівень; null — типово
 * @property array<int|string, array<string, array{type: string, value: string}>>|null $rewards Рівень → доріжка → нагорода
 */
#[Fillable(['key', 'title', 'theme', 'levels', 'rewards'])]
class Season extends Model
{
    protected function casts(): array
    {
        return [
            'levels' => 'array',
            'rewards' => 'array',
        ];
    }
}
