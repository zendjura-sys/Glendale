<?php

namespace App\Services\Party;

use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\PlayedPlace;
use App\Models\ReadyToPlay;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Services\FriendshipService;
use App\Support\Plugins\Plugins;

/**
 * «Готовий грати зараз»: один дотик — і друзі бачать, що людина вільна (у яку гру й до котрої).
 * Хто заповнив анкету тиммейта, на цей час потрапляє і в підбір тиммейтів («шукає зараз»).
 */
class ReadyBoard
{
    /** На скільки хвилин можна стати «готовим». */
    public const DURATIONS = [30, 60, 120, 180];

    public function __construct(private readonly FriendshipService $friendships) {}

    public function start(User $user, ?Game $game, int $minutes, ?string $note): ReadyToPlay
    {
        $until = now()->addMinutes($minutes);
        $ready = ReadyToPlay::query()->updateOrCreate(['user_id' => $user->id], [
            'game_id' => $game?->id,
            'note' => filled($note) ? trim((string) $note) : null,
            'until' => $until,
        ]);
        TeammateProfile::query()->where('user_id', $user->id)->update(['looking_until' => $until]);

        return $ready;
    }

    public function stop(User $user): void
    {
        ReadyToPlay::query()->where('user_id', $user->id)->delete();
        TeammateProfile::query()->where('user_id', $user->id)->where('looking_until', '>', now())->update(['looking_until' => null]);
    }

    public function mine(User $user): ?ReadyToPlay
    {
        $ready = ReadyToPlay::query()->with('game')->find($user->id);

        return $ready?->isActive() ? $ready : null;
    }

    /**
     * Друзі, які готові грати зараз: спершу ті, хто в ту саму гру, далі — свіжіші.
     *
     * @return list<array<string, mixed>>
     */
    public function friends(User $viewer, int $limit = 12): array
    {
        $ids = $this->friendships->friendIds($viewer);
        if ($ids === []) {
            return [];
        }
        $myGame = $this->mine($viewer)?->game_id;

        return array_values(ReadyToPlay::query()->with(['user', 'game'])->whereIn('user_id', $ids)->where('until', '>', now())
            ->latest('updated_at')->limit($limit * 2)->get()
            ->filter(fn (ReadyToPlay $r) => ! $r->user->isFrozen() && ! $r->user->isBanned())
            ->sortByDesc(fn (ReadyToPlay $r) => $myGame !== null && $r->game_id === $myGame)
            ->take($limit)
            ->map(fn (ReadyToPlay $r) => $r->toCard())->all());
    }

    /**
     * Ігри для швидкого вибору: «граю» й «хочу» з беклогу, ігри анкети тиммейта, у які грав.
     *
     * @return list<array<string, mixed>>
     */
    public function gameOptions(User $user, int $limit = 8): array
    {
        $ids = [];
        if (app(Plugins::class)->on('game_backlog')) {
            $ids = GameBacklog::query()->where('user_id', $user->id)->whereIn('status', [GameBacklog::PLAYING, GameBacklog::WANT])
                ->orderByRaw("status = 'playing' desc")->latest('updated_at')->limit($limit)->pluck('game_id')->all();
        }
        $ids = [...$ids, ...(TeammateProfile::query()->where('user_id', $user->id)->value('games') ?? [])];
        $ids = [...$ids, ...PlayedPlace::query()->where('user_id', $user->id)->where('kind', PlayedPlace::GAME)->latest('id')->limit($limit)->pluck('subject_id')->all()];
        $ids = array_slice(array_values(array_unique(array_map('intval', $ids))), 0, $limit);
        if ($ids === []) {
            return [];
        }
        $games = Game::query()->published()->whereIn('id', $ids)->get()->keyBy('id');

        return array_values(array_filter(array_map(fn (int $id) => $games->get($id)?->toCard(), $ids)));
    }
}
