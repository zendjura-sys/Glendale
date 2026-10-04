<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Переклад одного рядка інтерфейсу на мову.
 *
 * @property int $id
 * @property string $locale
 * @property string $hash
 * @property string $source
 * @property string $value
 * @property bool $is_manual
 */
#[Fillable(['locale', 'hash', 'source', 'value', 'is_manual'])]
class Translation extends Model
{
    protected function casts(): array
    {
        return ['is_manual' => 'boolean'];
    }

    public static function hashOf(string $source): string
    {
        return sha1($source);
    }
}
