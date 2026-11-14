<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\PlayedPlace;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Лідерборд гри: хто найбільше днів грав за 30 днів (зі статусу «Грає», Steam, Discord).
 * Загальний — топ-10; «Серед друзів» — друзі й ви. Акаунти без входу та приховані не враховуються.
 */
class GameLeaderboard
{
    public const DAYS = 30;

    /**
     * @param  list<int>  $friendIds
     * @return array{top: list<array<string, mixed>>, friends: list<array<string, mixed>>, me: array{place: int, days: int}|null}
     */
    public function board(Game $game, ?User $viewer, array $friendIds = []): array
    {
        $top = Cache::remember("games.board.{$game->id}", 600, fn () => $this->rows($game, null, 10));
        $friends = $viewer && $friendIds !== [] ? $this->rows($game, [...$friendIds, $viewer->id], 10) : [];

        return ['top' => $top, 'friends' => $friends, 'me' => $viewer ? $this->place($game, $viewer) : null];
    }

    /**
     * @param  list<int>|null  $only
     * @return list<array<string, mixed>>
     */
    private function rows(Game $game, ?array $only, int $limit): array
    {
        $rows = $this->query($game)
            ->when($only !== null, fn ($q) => $q->whereIn('user_id', $only))
            ->selectRaw('user_id, count(*) as days, max(day) as last_day')
            ->groupBy('user_id')->orderByDesc('days')->orderByDesc('last_day')->limit($limit)->get();
        $users = User::query()->whereIn('id', $rows->pluck('user_id'))->get()->keyBy('id');
        $out = [];
        foreach ($rows as $i => $row) {
            $user = $users->get((int) $row->user_id);
            if ($user instanceof User && ! $user->isBanned()) {
                $out[] = ['place' => $i + 1, 'days' => (int) $row->days, 'user' => $user->toCard()];
            }
        }

        return $out;
    }

    /** @return array{place: int, days: int}|null */
    private function place(Game $game, User $viewer): ?array
    {
        $days = (int) $this->query($game)->where('user_id', $viewer->id)->count();
        if ($days === 0) {
            return null;
        }
        $ahead = DB::query()->fromSub(
            $this->query($game)->selectRaw('user_id, count(*) as days')->groupBy('user_id'),
            'totals',
        )->where('days', '>', $days)->count();

        return ['place' => $ahead + 1, 'days' => $days];
    }

    private function query(Game $game): Builder
    {
        return DB::table('play_days')->where('kind', PlayedPlace::GAME)->where('subject_id', $game->id)
            ->where('day', '>=', CarbonImmutable::now()->subDays(self::DAYS - 1)->toDateString());
    }
}
