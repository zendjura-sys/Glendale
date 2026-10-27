<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Куди дублювати свої записи, новини сервера чи початок стріму: вебхук Discord
 * або канал Telegram (бот GameCon — адміністратор каналу). Адреса зберігається зашифрованою.
 *
 * @property int $id
 * @property string $owner_type user | server
 * @property int $owner_id
 * @property string $platform discord | telegram
 * @property string $target
 * @property string|null $label
 * @property list<string> $events
 * @property bool $enabled
 * @property string|null $last_error
 * @property CarbonInterface|null $last_sent_at
 */
class CrosspostTarget extends Model
{
    public const OWNERS = ['user', 'server'];

    public const PLATFORMS = ['discord', 'telegram'];

    /** Які події можна дублювати для кожного власника. */
    public const EVENTS = ['user' => ['posts', 'streams'], 'server' => ['news']];

    protected $fillable = ['owner_type', 'owner_id', 'platform', 'target', 'label', 'events', 'enabled', 'last_error', 'last_sent_at'];

    protected $hidden = ['target'];

    protected function casts(): array
    {
        return ['target' => 'encrypted', 'events' => 'array', 'enabled' => 'boolean', 'last_sent_at' => 'datetime'];
    }
}
