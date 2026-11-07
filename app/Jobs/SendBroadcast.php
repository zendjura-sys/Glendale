<?php

namespace App\Jobs;

use App\Models\ApiToken;
use App\Models\Broadcast;
use App\Models\User;
use App\Notifications\BroadcastNotice;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;

/** Розсилає сповіщення адміністрації пачками по 500 — без заблокованих і заморожених акаунтів. */
class SendBroadcast implements ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public function __construct(public readonly int $broadcastId) {}

    /**
     * @return Builder<User>
     */
    public static function audience(string $audience): Builder
    {
        return User::query()
            ->whereNull('banned_at')
            ->whereNull('frozen_at')
            ->when($audience === 'plus', fn (Builder $q) => $q->where('plus_until', '>', now()))
            ->when($audience === 'app', fn (Builder $q) => $q->whereIn('id', ApiToken::query()->select('user_id')))
            ->when($audience === 'staff', fn (Builder $q) => $q->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MODERATOR]));
    }

    public function handle(): void
    {
        $broadcast = Broadcast::query()->whereKey($this->broadcastId)->first();
        if ($broadcast === null || $broadcast->finished_at !== null) {
            return;
        }
        $sent = 0;
        self::audience($broadcast->audience)->chunkById(500, function (Collection $users) use ($broadcast, &$sent) {
            Notification::send($users, new BroadcastNotice($broadcast));
            $sent += $users->count();
        });
        $broadcast->update(['sent_count' => $sent, 'finished_at' => now()]);
    }
}
