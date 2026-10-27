<?php

namespace App\Models;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Бот бесіди: «Привітання» новеньких або «Автопост» за розкладом.
 *
 * @property int $id
 * @property int $conversation_id
 * @property string $kind
 * @property string $bot_name
 * @property string $body
 * @property bool $enabled
 * @property string|null $repeat once | daily | weekly
 * @property string|null $time Час за Києвом «HH:MM» (для щоденних і щотижневих)
 * @property list<int>|null $weekdays Дні тижня ISO: 1 — понеділок … 7 — неділя
 * @property CarbonInterface|null $next_run_at
 * @property Carbon|null $last_run_at
 * @property int|null $created_by
 * @property-read Conversation|null $conversation
 */
#[Fillable(['conversation_id', 'kind', 'bot_name', 'body', 'enabled', 'repeat', 'time', 'weekdays', 'next_run_at', 'last_run_at', 'created_by'])]
class ChatAutomation extends Model
{
    public const WELCOME = 'welcome';

    public const POST = 'post';

    public const ONCE = 'once';

    public const DAILY = 'daily';

    public const WEEKLY = 'weekly';

    public const REPEATS = [self::ONCE, self::DAILY, self::WEEKLY];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'weekdays' => 'array',
            'next_run_at' => 'datetime',
            'last_run_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
