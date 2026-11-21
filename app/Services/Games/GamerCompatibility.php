<?php

namespace App\Services\Games;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\PlayedPlace;
use App\Models\TeammateProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * «Сумісність N%» двох геймерів: спільні ігри (головне), спільна музика, спільні спільноти,
 * однаковий час гри й платформа. Причини — коди, підписи робить клієнт через tr().
 */
class GamerCompatibility
{
    /**
     * @return array{score: int, reasons: list<array<string, mixed>>}|null
     */
    public function between(User $viewer, User $other): ?array
    {
        if ($viewer->id === $other->id) {
            return null;
        }
        [$a, $b] = $viewer->id < $other->id ? [$viewer, $other] : [$other, $viewer];

        return Cache::remember("compat.{$a->id}.{$b->id}", 3600, fn () => $this->compute($viewer, $other));
    }

    /**
     * @return array{score: int, reasons: list<array<string, mixed>>}|null
     */
    private function compute(User $viewer, User $other): ?array
    {
        $mine = $this->games($viewer);
        $theirs = $this->games($other);
        if ($mine === [] && $theirs === []) {
            return null;
        }
        $score = 0;
        $reasons = [];

        $shared = array_values(array_intersect($mine, $theirs));
        if ($shared !== [] && $mine !== [] && $theirs !== []) {
            // Частка спільних ігор від меншого списку: 1 гра з 2 — це багато, 1 з 20 — мало.
            $score += (int) round(55 * min(1, count($shared) / max(1, min(count($mine), count($theirs)))));
            $names = Game::query()->whereIn('id', array_slice($shared, 0, 3))->pluck('name')->all();
            $reasons[] = ['type' => 'games', 'count' => count($shared), 'names' => $names];
        }

        $artists = $this->artists($viewer, $other);
        if ($artists !== []) {
            $score += min(15, 5 * count($artists));
            $reasons[] = ['type' => 'music', 'names' => array_slice($artists, 0, 2)];
        }

        $communities = DB::table('community_members as a')->join('community_members as b', 'a.community_id', '=', 'b.community_id')
            ->where('a.user_id', $viewer->id)->where('b.user_id', $other->id)->count();
        if ($communities > 0) {
            $score += min(10, 5 * $communities);
            $reasons[] = ['type' => 'communities', 'count' => $communities];
        }

        $pa = TeammateProfile::query()->where('user_id', $viewer->id)->first();
        $pb = TeammateProfile::query()->where('user_id', $other->id)->first();
        if ($pa && $pb) {
            if (array_intersect($pa->times ?? [], $pb->times ?? []) !== []) {
                $score += 10;
                $reasons[] = ['type' => 'time'];
            }
            if ($pa->platform && $pa->platform === $pb->platform) {
                $score += 5;
                $reasons[] = ['type' => 'platform'];
            }
            if ($pa->languages && $pb->languages && array_intersect($pa->languages, $pb->languages) !== []) {
                $score += 5;
                $reasons[] = ['type' => 'language'];
            }
        }

        return ['score' => min(100, $score), 'reasons' => $reasons];
    }

    /**
     * Ігри людини: у що грала за 90 днів, беклог «граю»/«пройшов», підписки, анкета тиммейта.
     *
     * @return list<int>
     */
    private function games(User $user): array
    {
        $ids = DB::table('play_days')->where('user_id', $user->id)->where('kind', PlayedPlace::GAME)
            ->where('day', '>=', CarbonImmutable::now()->subDays(90)->toDateString())->distinct()->pluck('subject_id')
            ->merge(GameBacklog::query()->where('user_id', $user->id)->whereIn('status', [GameBacklog::PLAYING, GameBacklog::DONE])->pluck('game_id'))
            ->merge(Follow::query()->where('user_id', $user->id)->where('kind', Follow::GAME)->pluck('subject_id'))
            ->merge(TeammateProfile::query()->where('user_id', $user->id)->value('games') ?? []);

        return array_values(array_unique(array_map('intval', $ids->all())));
    }

    /**
     * Спільні виконавці за 90 днів прослуховувань.
     *
     * @return list<string>
     */
    private function artists(User $a, User $b): array
    {
        $since = CarbonImmutable::now()->subDays(90);
        $top = fn (User $u) => DB::table('music_plays')->where('user_id', $u->id)->where('played_at', '>=', $since)
            ->where('artist', '!=', '')->selectRaw('artist, count(*) as c')->groupBy('artist')->orderByDesc('c')->limit(30)->pluck('artist')->all();

        return array_values(array_intersect($top($a), $top($b)));
    }
}
