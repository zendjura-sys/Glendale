<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\PlayedPlace;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Оцінка гри від гравців GameCon: 1–10, ставлять лише ті, хто в неї грав
 * (статус «Граю» або позначка «Я грав» на сторінці гри).
 */
class CommunityRatings
{
    /** Скільки оцінок потрібно, щоб показати середню. */
    public const MIN_VOTES = 3;

    /**
     * @return array{average: float|null, count: int, distribution: list<int>, mine: int|null, played: bool}
     */
    public function summary(Game $game, ?User $viewer): array
    {
        $rows = DB::table('game_ratings')->where('game_id', $game->id)
            ->groupBy('score')->selectRaw('score, COUNT(*) as total')->pluck('total', 'score');
        $count = (int) $rows->sum();
        $distribution = [];
        for ($s = 1; $s <= 10; $s++) {
            $distribution[] = (int) ($rows[$s] ?? 0);
        }
        $sum = 0;
        foreach ($rows as $score => $total) {
            $sum += (int) $score * (int) $total;
        }
        $mine = $viewer !== null ? DB::table('game_ratings')->where('game_id', $game->id)->where('user_id', $viewer->id)->value('score') : null;

        return [
            'average' => $count >= self::MIN_VOTES ? round($sum / $count, 1) : null,
            'count' => $count,
            'distribution' => $distribution,
            'mine' => is_numeric($mine) ? (int) $mine : null,
            'played' => $viewer !== null && $this->played($viewer, $game),
        ];
    }

    public function played(User $user, Game $game): bool
    {
        return PlayedPlace::query()->where('user_id', $user->id)->where('kind', PlayedPlace::GAME)->where('subject_id', $game->id)->exists();
    }

    public function markPlayed(User $user, Game $game): void
    {
        PlayedPlace::query()->firstOrCreate(['user_id' => $user->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id]);
    }

    /** Оцінка 1–10 або null — прибрати свою оцінку. */
    public function rate(User $user, Game $game, ?int $score): void
    {
        if ($score === null) {
            DB::table('game_ratings')->where('user_id', $user->id)->where('game_id', $game->id)->delete();

            return;
        }
        DB::table('game_ratings')->updateOrInsert(
            ['user_id' => $user->id, 'game_id' => $game->id],
            ['score' => max(1, min(10, $score)), 'updated_at' => now(), 'created_at' => now()],
        );
    }
}
