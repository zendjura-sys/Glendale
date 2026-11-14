<?php

namespace App\Jobs;

use App\Models\ApiToken;
use App\Models\Broadcast;
use App\Models\CommunityMember;
use App\Models\GameBacklog;
use App\Models\PlayedPlace;
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
     * Аудиторія + сегмент (усі умови разом, через «і»).
     *
     * @param  array<string, mixed>  $filters
     * @return Builder<User>
     */
    public static function audience(string $audience, array $filters = []): Builder
    {
        $country = is_string($filters['country'] ?? null) ? $filters['country'] : null;
        $locale = is_string($filters['locale'] ?? null) ? $filters['locale'] : null;
        $joined = $filters['joined'] ?? null;
        $activity = $filters['activity'] ?? null;
        $gameId = is_numeric($filters['game_id'] ?? null) ? (int) $filters['game_id'] : null;
        $communityId = is_numeric($filters['community_id'] ?? null) ? (int) $filters['community_id'] : null;

        return User::query()
            ->whereNull('banned_at')
            ->whereNull('frozen_at')
            ->when($audience === 'plus', fn (Builder $q) => $q->where('plus_until', '>', now()))
            ->when($audience === 'app', fn (Builder $q) => $q->whereIn('id', ApiToken::query()->select('user_id')))
            ->when($audience === 'staff', fn (Builder $q) => $q->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MODERATOR]))
            ->when($country, fn (Builder $q, string $c) => $q->where('country', $c))
            ->when($locale, fn (Builder $q, string $l) => $q->where('locale', $l))
            ->when($joined === 'week', fn (Builder $q) => $q->where('created_at', '>=', now()->subWeek()))
            ->when($joined === 'month', fn (Builder $q) => $q->where('created_at', '>=', now()->subMonth()))
            ->when($joined === 'old', fn (Builder $q) => $q->where('created_at', '<', now()->subMonths(3)))
            ->when($activity === 'active', fn (Builder $q) => $q->where('last_seen_at', '>=', now()->subWeek()))
            ->when($activity === 'dormant', fn (Builder $q) => $q->where(fn (Builder $w) => $w->whereNull('last_seen_at')->orWhere('last_seen_at', '<', now()->subMonth())))
            ->when($gameId, fn (Builder $q, int $id) => $q->where(fn (Builder $w) => $w
                ->whereIn('id', GameBacklog::query()->select('user_id')->where('game_id', $id))
                ->orWhereIn('id', PlayedPlace::query()->select('user_id')->where('kind', PlayedPlace::GAME)->where('subject_id', $id))))
            ->when($communityId, fn (Builder $q, int $id) => $q->whereIn('id', CommunityMember::query()->select('user_id')->where('community_id', $id)->where('status', 'active')));
    }

    public function handle(): void
    {
        $broadcast = Broadcast::query()->whereKey($this->broadcastId)->first();
        if ($broadcast === null || $broadcast->finished_at !== null) {
            return;
        }
        $sent = 0;
        self::audience($broadcast->audience, $broadcast->filters ?? [])->chunkById(500, function (Collection $users) use ($broadcast, &$sent) {
            Notification::send($users, new BroadcastNotice($broadcast));
            $sent += $users->count();
        });
        $broadcast->update(['sent_count' => $sent, 'finished_at' => now()]);
    }
}
