<?php

namespace App\Services;

use App\Models\Follow;
use App\Models\User;
use App\Notifications\FriendPlaying;

/**
 * Підписка на гру чи сервер: сповіщення, коли туди заходить друг.
 */
class FollowAlerts
{
    public function __construct(private readonly FriendshipService $friendships) {}

    public function has(User $user, string $kind, int $id): bool
    {
        return Follow::query()->where('user_id', $user->id)->where('kind', $kind)->where('subject_id', $id)->exists();
    }

    public function toggle(User $user, string $kind, int $id): bool
    {
        abort_unless(in_array($kind, Follow::KINDS, true), 404);
        $existing = Follow::query()->where('user_id', $user->id)->where('kind', $kind)->where('subject_id', $id)->first();
        if ($existing) {
            $existing->delete();

            return false;
        }
        Follow::query()->create(['user_id' => $user->id, 'kind' => $kind, 'subject_id' => $id]);

        return true;
    }

    public function friendsStarted(User $player): void
    {
        $kind = $player->playing_kind;
        $id = $player->playing_ref_id;
        if (! in_array($kind, Follow::KINDS, true) || $id === null) {
            return;
        }

        $friendIds = $this->friendships->friendIds($player);
        if ($friendIds === []) {
            return;
        }

        User::query()
            ->whereIn('id', Follow::query()->where('kind', $kind)->where('subject_id', $id)->whereIn('user_id', $friendIds)->pluck('user_id'))
            ->get()
            ->each(fn (User $friend) => $friend->notify(new FriendPlaying($player)));
    }
}
