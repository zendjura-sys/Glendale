<?php

namespace App\Services;

use App\Models\FriendMark;
use App\Models\Friendship;
use App\Models\User;
use App\Notifications\FriendRequestAccepted;
use App\Notifications\FriendRequestReceived;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class FriendshipService
{
    public const NONE = 'none';

    public const FRIENDS = 'friends';

    public const OUTGOING = 'outgoing';

    public const INCOMING = 'incoming';

    public const SELF = 'self';

    /** @var array<int, list<int>> */
    private array $friendIdsCache = [];

    public function status(?User $viewer, User $target): string
    {
        if (! $viewer) {
            return self::NONE;
        }

        if ($viewer->is($target)) {
            return self::SELF;
        }

        $friendship = $this->between($viewer, $target);

        return match (true) {
            $friendship === null => self::NONE,
            $friendship->status === Friendship::ACCEPTED => self::FRIENDS,
            $friendship->requester_id === $viewer->id => self::OUTGOING,
            default => self::INCOMING,
        };
    }

    public function between(User $a, User $b): ?Friendship
    {
        return Friendship::query()
            ->where(fn (Builder $q) => $q->where('requester_id', $a->id)->where('addressee_id', $b->id))
            ->orWhere(fn (Builder $q) => $q->where('requester_id', $b->id)->where('addressee_id', $a->id))
            ->first();
    }

    /**
     * Надіслати заявку або прийняти зустрічну.
     */
    public function request(User $from, User $to): string
    {
        abort_if($from->is($to), 422, 'Не можна додати себе в друзі.');

        return DB::transaction(function () use ($from, $to) {
            $existing = $this->between($from, $to);

            if ($existing?->status === Friendship::ACCEPTED) {
                return self::FRIENDS;
            }

            if ($existing && $existing->addressee_id === $from->id) {
                return $this->accept($from, $to);
            }

            if ($existing) {
                return self::OUTGOING;
            }

            Friendship::query()->create([
                'requester_id' => $from->id,
                'addressee_id' => $to->id,
                'status' => Friendship::PENDING,
            ]);

            $to->notify(new FriendRequestReceived($from));

            return self::OUTGOING;
        });
    }

    public function accept(User $user, User $requester): string
    {
        $friendship = Friendship::query()
            ->where('requester_id', $requester->id)
            ->where('addressee_id', $user->id)
            ->where('status', Friendship::PENDING)
            ->firstOrFail();

        $friendship->update(['status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $this->forget($user, $requester);

        $requester->notify(new FriendRequestAccepted($user));

        return self::FRIENDS;
    }

    /**
     * Видалити з друзів, відхилити або скасувати заявку.
     * Колишній друг лишається підписником, як у ВК: заявка повертається йому у вхідні.
     */
    public function remove(User $user, User $other): string
    {
        $friendship = $this->between($user, $other);

        if (! $friendship) {
            return self::NONE;
        }

        if ($friendship->status === Friendship::ACCEPTED) {
            FriendMark::query()
                ->where(fn (Builder $query) => $query->where('user_id', $user->id)->where('friend_id', $other->id))
                ->orWhere(fn (Builder $query) => $query->where('user_id', $other->id)->where('friend_id', $user->id))
                ->delete();
            $friendship->update([
                'requester_id' => $other->id,
                'addressee_id' => $user->id,
                'status' => Friendship::PENDING,
                'accepted_at' => null,
            ]);
            $this->forget($user, $other);

            return self::INCOMING;
        }

        $friendship->delete();

        return self::NONE;
    }

    /**
     * @return list<int>
     */
    public function friendIds(User $user): array
    {
        return $this->friendIdsCache[$user->id] ??= array_values(Friendship::query()
            ->where('status', Friendship::ACCEPTED)
            ->where(fn (Builder $q) => $q->where('requester_id', $user->id)->orWhere('addressee_id', $user->id))
            ->get(['requester_id', 'addressee_id'])
            ->map(fn (Friendship $f) => $f->requester_id === $user->id ? $f->addressee_id : $f->requester_id)
            ->all());
    }

    /**
     * @return Builder<User>
     */
    public function friendsQuery(User $user): Builder
    {
        return User::query()->whereIn('id', $this->friendIds($user));
    }

    /**
     * @return Builder<User>
     */
    public function incomingQuery(User $user): Builder
    {
        return User::query()->whereIn('id', Friendship::query()
            ->select('requester_id')
            ->where('addressee_id', $user->id)
            ->where('status', Friendship::PENDING));
    }

    /**
     * @return Builder<User>
     */
    public function outgoingQuery(User $user): Builder
    {
        return User::query()->whereIn('id', Friendship::query()
            ->select('addressee_id')
            ->where('requester_id', $user->id)
            ->where('status', Friendship::PENDING));
    }

    public function incomingCount(User $user): int
    {
        return Friendship::query()
            ->where('addressee_id', $user->id)
            ->where('status', Friendship::PENDING)
            ->count();
    }

    public function mutualCount(User $a, User $b): int
    {
        return count(array_intersect($this->friendIds($a), $this->friendIds($b)));
    }

    /**
     * Можливі знайомі: друзі друзів, відсортовані за кількістю спільних; добираємо новачками.
     *
     * @return list<array{user: User, mutual: int}>
     */
    public function suggestions(User $user, int $limit = 6): array
    {
        $friendIds = $this->friendIds($user);
        $excluded = array_merge(
            [$user->id],
            $friendIds,
            Friendship::query()->where('requester_id', $user->id)->pluck('addressee_id')->all(),
            Friendship::query()->where('addressee_id', $user->id)->pluck('requester_id')->all(),
        );

        $scores = [];
        if ($friendIds !== []) {
            Friendship::query()
                ->where('status', Friendship::ACCEPTED)
                ->where(fn (Builder $q) => $q->whereIn('requester_id', $friendIds)->orWhereIn('addressee_id', $friendIds))
                ->get(['requester_id', 'addressee_id'])
                ->each(function (Friendship $f) use (&$scores, $friendIds) {
                    foreach ([$f->requester_id, $f->addressee_id] as $id) {
                        if (! in_array($id, $friendIds, true)) {
                            $scores[$id] = ($scores[$id] ?? 0) + 1;
                        }
                    }
                });
        }

        $scores = array_diff_key($scores, array_flip($excluded));
        arsort($scores);
        $ids = array_slice(array_keys($scores), 0, $limit);

        $users = User::query()->whereIn('id', $ids)->whereNull('banned_at')->whereNull('frozen_at')->get()->keyBy('id');
        $result = [];
        foreach ($ids as $id) {
            if ($users->has($id)) {
                $result[] = ['user' => $users[$id], 'mutual' => $scores[$id]];
            }
        }

        if (count($result) < $limit) {
            User::query()
                ->whereNotIn('id', array_merge($excluded, $ids))
                ->whereNull('banned_at')->whereNull('frozen_at')
                ->latest()
                ->limit($limit - count($result))
                ->get()
                ->each(function (User $candidate) use (&$result) {
                    $result[] = ['user' => $candidate, 'mutual' => 0];
                });
        }

        return $result;
    }

    private function forget(User ...$users): void
    {
        foreach ($users as $user) {
            unset($this->friendIdsCache[$user->id]);
        }
    }
}
