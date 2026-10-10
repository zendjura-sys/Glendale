<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Запис журналу входів.
 *
 * @property int $id
 * @property int $user_id
 * @property string $method password | google | discord | app | passkey | 2fa
 * @property bool $success
 * @property string|null $ip
 * @property string|null $user_agent
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'method', 'success', 'ip', 'user_agent', 'created_at'])]
class LoginEvent extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['success' => 'boolean', 'created_at' => 'datetime'];
    }
}
