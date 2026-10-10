<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $platform telegram | discord
 * @property string $owner_type family | clan | community
 * @property int $owner_id
 * @property string|null $chat_id чат Telegram або канал Discord
 * @property string|null $guild_id
 * @property string|null $title
 * @property bool $post_events
 * @property bool $post_reminders
 * @property bool $post_posts
 * @property string|null $member_role_id
 * @property string|null $leader_role_id
 * @property Carbon|null $roles_synced_at
 * @property string|null $roles_error
 * @property int|null $linked_by
 */
#[Fillable(['platform', 'owner_type', 'owner_id', 'chat_id', 'guild_id', 'title', 'post_events', 'post_reminders', 'post_posts', 'member_role_id', 'leader_role_id', 'roles_synced_at', 'roles_error', 'linked_by'])]
class BotLink extends Model
{
    public const TELEGRAM = 'telegram';

    public const DISCORD = 'discord';

    public const OWNERS = ['family', 'clan', 'community'];

    protected function casts(): array
    {
        return [
            'post_events' => 'boolean',
            'post_reminders' => 'boolean',
            'post_posts' => 'boolean',
            'roles_synced_at' => 'datetime',
        ];
    }

    public function hasRoles(): bool
    {
        return $this->platform === self::DISCORD && $this->guild_id !== null && ($this->member_role_id !== null || $this->leader_role_id !== null);
    }
}
