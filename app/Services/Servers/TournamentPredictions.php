<?php

namespace App\Services\Servers;

use App\Models\Tournament;
use App\Models\TournamentEntry;
use App\Models\TournamentMatch;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Прогнози на матчі (№260): «хто переможе» до результату; 10 очок за влучний прогноз.
 * Очки не зберігаються — рахуються з winner_entry_id, тож виправлений результат одразу
 * перераховує таблицю. Без грошей і ставок: лише очки й таблиця прогнозистів.
 */
class TournamentPredictions
{
    public const POINTS = 10;

    public function predict(Tournament $tournament, TournamentMatch $match, User $user, int $entryId): void
    {
        abort_unless($match->tournament_id === $tournament->id, 404);
        abort_unless($tournament->status === Tournament::RUNNING, 422, 'Прогнози приймаються, поки турнір триває.');
        abort_unless($match->a_entry_id !== null && $match->b_entry_id !== null, 422, 'У матчі ще немає обох суперників.');
        abort_if($match->winner_entry_id !== null, 422, 'Матч уже зіграно — прогноз не прийнято.');
        abort_if($entryId !== $match->a_entry_id && $entryId !== $match->b_entry_id, 422, 'Оберіть одного з учасників матчу.');
        $players = TournamentEntry::query()->whereIn('id', [$match->a_entry_id, $match->b_entry_id])->pluck('user_id')->all();
        abort_if(in_array($user->id, $players, true), 422, 'На власний матч прогноз не робиться.');

        DB::table('tournament_predictions')->updateOrInsert(
            ['tournament_match_id' => $match->id, 'user_id' => $user->id],
            ['tournament_entry_id' => $entryId, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    /**
     * Для кожного матчу: скільки за A і за B, і мій вибір.
     *
     * @return array<int, array{a: int, b: int, mine: int|null}>
     */
    public function forMatches(Tournament $tournament, User $viewer): array
    {
        $rows = DB::table('tournament_predictions as p')
            ->join('tournament_matches as m', 'm.id', '=', 'p.tournament_match_id')
            ->where('m.tournament_id', $tournament->id)
            ->get(['p.tournament_match_id', 'p.tournament_entry_id', 'p.user_id', 'm.a_entry_id', 'm.b_entry_id']);
        $out = [];
        foreach ($rows as $row) {
            $id = (int) $row->tournament_match_id;
            $out[$id] ??= ['a' => 0, 'b' => 0, 'mine' => null];
            if ((int) $row->tournament_entry_id === (int) $row->a_entry_id) {
                $out[$id]['a']++;
            } elseif ((int) $row->tournament_entry_id === (int) $row->b_entry_id) {
                $out[$id]['b']++;
            }
            if ((int) $row->user_id === $viewer->id) {
                $out[$id]['mine'] = (int) $row->tournament_entry_id;
            }
        }

        return $out;
    }

    /**
     * Таблиця прогнозистів турніру: очки за влучні прогнози (зіграні матчі).
     *
     * @return list<array{user: array<string, mixed>, points: int, hits: int, made: int}>
     */
    public function leaders(Tournament $tournament, int $limit = 10): array
    {
        $rows = DB::table('tournament_predictions as p')
            ->join('tournament_matches as m', 'm.id', '=', 'p.tournament_match_id')
            ->where('m.tournament_id', $tournament->id)->whereNotNull('m.winner_entry_id')
            ->groupBy('p.user_id')
            ->selectRaw('p.user_id, SUM(CASE WHEN p.tournament_entry_id = m.winner_entry_id THEN 1 ELSE 0 END) as hits, COUNT(*) as made')
            ->orderByDesc('hits')->orderBy('made')->limit($limit)->get();
        $users = User::query()->whereIn('id', $rows->pluck('user_id')->all())->get()->keyBy('id');
        $out = [];
        foreach ($rows as $row) {
            $user = $users->get($row->user_id);
            if ($user !== null && (int) $row->hits > 0) {
                $out[] = ['user' => $user->toCard(), 'points' => (int) $row->hits * self::POINTS, 'hits' => (int) $row->hits, 'made' => (int) $row->made];
            }
        }

        return $out;
    }
}
