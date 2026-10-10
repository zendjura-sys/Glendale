<?php

namespace App\Console\Commands;

use App\Models\BotLink;
use App\Services\Bots\BotHub;
use Illuminate\Console\Command;

/** Видає й забирає ролі Discord за складом сімей, кланів і спільнот. */
class BotsRoles extends Command
{
    protected $signature = 'bots:roles';

    protected $description = 'Синхронізувати ролі Discord зі складом груп';

    public function handle(BotHub $hub): int
    {
        $added = 0;
        $removed = 0;
        BotLink::query()->where('platform', BotLink::DISCORD)->whereNotNull('guild_id')
            ->where(fn ($q) => $q->whereNotNull('member_role_id')->orWhereNotNull('leader_role_id'))
            ->orderBy('id')->each(function (BotLink $link) use ($hub, &$added, &$removed) {
                $result = $hub->syncRoles($link);
                $added += $result['added'];
                $removed += $result['removed'];
            });
        $this->info("Ролей видано: {$added}, забрано: {$removed}");

        return self::SUCCESS;
    }
}
