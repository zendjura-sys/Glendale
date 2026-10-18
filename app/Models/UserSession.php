<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Відкрита сесія браузера.
 *
 * @property int $id
 * @property int $user_id
 * @property string $session_hash
 * @property string $handle
 * @property string|null $ip
 * @property string|null $user_agent
 * @property Carbon $last_active_at
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'session_hash', 'handle', 'ip', 'user_agent', 'last_active_at'])]
class UserSession extends Model
{
    protected function casts(): array
    {
        return ['last_active_at' => 'datetime', 'handle' => 'encrypted'];
    }
}
