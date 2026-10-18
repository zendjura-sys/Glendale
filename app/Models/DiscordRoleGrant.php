<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $bot_link_id
 * @property string $discord_user_id
 * @property string $role_id
 */
#[Fillable(['bot_link_id', 'discord_user_id', 'role_id'])]
class DiscordRoleGrant extends Model
{
    public const UPDATED_AT = null;
}
