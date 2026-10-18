<?php

namespace App\Services;

use App\Models\Follow;
use App\Models\Friendship;
use App\Models\Game;
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

    /**
     * Люди, які підписані на ті самі ігри. Не друзі й не ті, кому вже написали.
     *
     * @return list<array<string, mixed>>
     */
    public function sameGame(User $user, int $limit = 6): array
    {
        $gameIds = Follow::query()->where('user_id', $user->id)->where('kind', Follow::GAME)->pluck('subject_id');
        if ($gameIds->isEmpty()) {
            return [];
        }

        $excluded = array_merge(
            [$user->id],
            $this->friendships->friendIds($user),
            Friendship::query()->where('requester_id', $user->id)->pluck('addressee_id')->all(),
            Friendship::query()->where('addressee_id', $user->id)->pluck('requester_id')->all(),
        );
        $rows = Follow::query()
            ->selectRaw('user_id, count(*) as shared, min(subject_id) as game_id')
            ->where('kind', Follow::GAME)
            ->whereIn('subject_id', $gameIds)
            ->whereNotIn('user_id', $excluded)
            ->groupBy('user_id')
            ->orderByDesc('shared')
            ->limit($limit)
            ->toBase()
            ->get();
        $users = User::query()->whereIn('id', $rows->pluck('user_id'))->whereNull('banned_at')->whereNull('frozen_at')->get()->keyBy('id');
        $games = Game::query()->whereIn('id', $rows->pluck('game_id'))->get()->keyBy('id');
        $people = [];
        foreach ($rows as $row) {
            $person = $users->get($row->user_id);
            $game = $games->get($row->game_id);
            if ($person && $game) {
                $people[] = [...$person->toCard(), 'shared_game' => $game->name];
            }
        }

        return $people;
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
