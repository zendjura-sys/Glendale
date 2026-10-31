<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\User;
use App\Services\FriendshipService;

/**
 * Беклог ігор: «хочу — граю — пройшов — кинув». Граю, пройшов чи кинув — значить, грав:
 * гра одразу відкриває оцінку гравців. Чужу дошку видно, якщо видно профіль людини.
 */
class Backlog
{
    /** Скільки ігор показувати в одній колонці дошки. */
    public const COLUMN_LIMIT = 200;

    public function __construct(
        private readonly CommunityRatings $ratings,
        private readonly FriendshipService $friendships,
    ) {}

    /** Новий стан гри або null — прибрати з беклогу. */
    public function set(User $user, Game $game, ?string $status): void
    {
        if ($status === null) {
            GameBacklog::query()->where('user_id', $user->id)->where('game_id', $game->id)->delete();

            return;
        }

        GameBacklog::query()->updateOrCreate(['user_id' => $user->id, 'game_id' => $game->id], ['status' => $status]);
        if ($status !== GameBacklog::WANT) {
            $this->ratings->markPlayed($user, $game);
        }
    }

    public function statusOf(User $user, Game $game): ?string
    {
        $status = GameBacklog::query()->where('user_id', $user->id)->where('game_id', $game->id)->value('status');

        return is_string($status) ? $status : null;
    }

    /** Закритий профіль — дошку бачать лише друзі й сама людина. */
    public function canView(User $owner, ?User $viewer): bool
    {
        if ($viewer?->is($owner) || $viewer?->isStaff()) {
            return true;
        }
        if (! $owner->is_private) {
            return true;
        }

        return $viewer !== null && in_array($viewer->id, $this->friendships->friendIds($owner), true);
    }

    /**
     * Дошка: чотири колонки, свіжі зміни зверху.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function board(User $owner): array
    {
        $board = array_fill_keys(GameBacklog::STATUSES, []);
        GameBacklog::query()->with('game')->where('user_id', $owner->id)
            ->whereHas('game', fn ($q) => $q->where('is_published', true))
            ->latest('updated_at')->limit(self::COLUMN_LIMIT * 4)->get()
            ->each(function (GameBacklog $row) use (&$board) {
                if (count($board[$row->status] ?? []) < self::COLUMN_LIMIT) {
                    $board[$row->status][] = ['game' => $row->game->toCard(), 'updated_at' => $row->updated_at->toIso8601String()];
                }
            });

        return $board;
    }

    /**
     * Скільки ігор у кожному стані й у що людина грає зараз (для профілю).
     *
     * @return array{counts: array<string, int>, playing: list<array<string, mixed>>}
     */
    public function summary(User $owner): array
    {
        $counts = GameBacklog::query()->where('user_id', $owner->id)->groupBy('status')
            ->selectRaw('status, COUNT(*) as total')->pluck('total', 'status');

        return [
            'counts' => array_map(fn (string $status) => (int) ($counts[$status] ?? 0), array_combine(GameBacklog::STATUSES, GameBacklog::STATUSES)),
            'playing' => array_values(GameBacklog::query()->with('game')->where('user_id', $owner->id)->where('status', GameBacklog::PLAYING)
                ->whereHas('game', fn ($q) => $q->where('is_published', true))
                ->latest('updated_at')->limit(4)->get()
                ->map(fn (GameBacklog $row) => $row->game->toCard())->all()),
        ];
    }

    /**
     * У що зараз грають друзі: остання гра «граю» кожного друга, свіжі — зверху.
     *
     * @return list<array<string, mixed>>
     */
    public function friendsPlaying(User $viewer, int $limit = 12): array
    {
        $ids = $this->friendships->friendIds($viewer);
        if ($ids === []) {
            return [];
        }

        $seen = [];
        $out = [];
        GameBacklog::query()->with(['game', 'user'])->whereIn('user_id', $ids)->where('status', GameBacklog::PLAYING)
            ->whereHas('game', fn ($q) => $q->where('is_published', true))
            ->latest('updated_at')->limit($limit * 4)->get()
            ->each(function (GameBacklog $row) use (&$seen, &$out, $limit) {
                if (isset($seen[$row->user_id]) || count($out) >= $limit) {
                    return;
                }
                $seen[$row->user_id] = true;
                $out[] = ['user' => $row->user->toCard(), 'game' => $row->game->toCard(), 'since' => $row->updated_at->toIso8601String()];
            });

        return $out;
    }
}
