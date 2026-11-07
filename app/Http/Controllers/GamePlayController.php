<?php

namespace App\Http\Controllers;

use App\Models\Duel;
use App\Models\FpsReport;
use App\Models\Game;
use App\Models\GameGoal;
use App\Models\User;
use App\Notifications\AccountNotice;
use App\Services\Profile\MySetup;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Цілі в грі, FPS від спільноти й дуелі між гравцями. */
class GamePlayController extends Controller
{
    public const MAX_GOALS = 10;

    public function goals(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_goals');

        return response()->json(['goals' => GameGoal::query()->where('user_id', $request->user()->id)->where('game_id', $game->id)
            ->orderByRaw('done_at is not null')->orderBy('id')->get()
            ->map(fn (GameGoal $g) => ['id' => $g->id, 'title' => $g->title, 'target' => $g->target, 'progress' => $g->progress, 'done' => $g->done_at !== null])->values()->all()]);
    }

    public function storeGoal(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_goals');
        $data = $request->validate(['title' => ['required', 'string', 'min:3', 'max:120'], 'target' => ['nullable', 'integer', 'min:1', 'max:1000000']]);
        abort_if(GameGoal::query()->where('user_id', $request->user()->id)->where('game_id', $game->id)->whereNull('done_at')->count() >= self::MAX_GOALS, 422, 'Не більше '.self::MAX_GOALS.' активних цілей у грі.');
        GameGoal::query()->create(['user_id' => $request->user()->id, 'game_id' => $game->id, 'title' => trim($data['title']), 'target' => $data['target'] ?? null]);

        return $this->goals($request, $game);
    }

    /** Прогрес (число) або «виконано» для цілі без числа. */
    public function updateGoal(Request $request, Game $game, GameGoal $goal): JsonResponse
    {
        abort_unless($goal->user_id === $request->user()->id && $goal->game_id === $game->id, 404);
        $data = $request->validate(['progress' => ['nullable', 'integer', 'min:0', 'max:1000000'], 'done' => ['nullable', 'boolean']]);
        if (isset($data['progress'])) {
            $goal->progress = $goal->target !== null ? min((int) $data['progress'], $goal->target) : (int) $data['progress'];
        }
        $done = $data['done'] ?? ($goal->target !== null && $goal->progress >= $goal->target);
        $goal->done_at = $done ? ($goal->done_at ?? now()) : null;
        $goal->save();

        return $this->goals($request, $game);
    }

    public function destroyGoal(Request $request, Game $game, GameGoal $goal): JsonResponse
    {
        abort_unless($goal->user_id === $request->user()->id && $goal->game_id === $game->id, 404);
        $goal->delete();

        return $this->goals($request, $game);
    }

    /** FPS від спільноти: медіана за відеокартами для обраних роздільності й налаштувань. */
    public function fps(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('fps_reports');
        $resolution = in_array($request->query('resolution'), FpsReport::RESOLUTIONS, true) ? (string) $request->query('resolution') : '1080p';
        $preset = array_key_exists((string) $request->query('preset'), FpsReport::PRESETS) ? (string) $request->query('preset') : 'high';

        $rows = FpsReport::query()->where('game_id', $game->id)->where('resolution', $resolution)->where('preset', $preset)->get(['gpu', 'fps'])
            ->groupBy(fn (FpsReport $r) => mb_strtolower(trim($r->gpu)))
            ->map(function ($group) {
                $values = $group->pluck('fps')->sort()->values();
                $mid = intdiv($values->count(), 2);
                $median = $values->count() % 2 ? $values[$mid] : intdiv($values[$mid - 1] + $values[$mid], 2);

                return ['gpu' => (string) $group->first()->gpu, 'fps' => (int) $median, 'reports' => $values->count()];
            })->sortByDesc('fps')->take(15)->values()->all();
        $viewer = $request->user();
        $mine = $viewer ? FpsReport::query()->where('game_id', $game->id)->where('user_id', $viewer->id)->first() : null;
        $pc = $viewer ? app(MySetup::class)->of($viewer)['pc'] : null;

        return response()->json([
            'rows' => $rows,
            'total' => FpsReport::query()->where('game_id', $game->id)->count(),
            'resolution' => $resolution,
            'preset' => $preset,
            'resolutions' => FpsReport::RESOLUTIONS,
            'presets' => FpsReport::PRESETS,
            'mine' => $mine ? $mine->only(['gpu', 'cpu', 'resolution', 'preset', 'fps']) : null,
            'pc' => $pc,
        ]);
    }

    public function storeFps(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('fps_reports');
        $data = $request->validate([
            'gpu' => ['required', 'string', 'min:3', 'max:80'],
            'cpu' => ['nullable', 'string', 'max:80'],
            'resolution' => ['required', Rule::in(FpsReport::RESOLUTIONS)],
            'preset' => ['required', Rule::in(array_keys(FpsReport::PRESETS))],
            'fps' => ['required', 'integer', 'min:5', 'max:1000'],
        ]);
        FpsReport::query()->updateOrCreate(['game_id' => $game->id, 'user_id' => $request->user()->id], [...$data, 'gpu' => trim($data['gpu']), 'cpu' => isset($data['cpu']) ? trim($data['cpu']) : null]);
        $request->query->set('resolution', $data['resolution']);
        $request->query->set('preset', $data['preset']);

        return $this->fps($request, $game);
    }

    public function duels(Request $request): Response
    {
        app(Plugins::class)->ensure('duels');
        $user = $request->user();
        $duels = Duel::query()->with(['challenger', 'opponent', 'game'])
            ->where(fn (Builder $q) => $q->where('challenger_id', $user->id)->orWhere('opponent_id', $user->id))
            ->latest('id')->limit(60)->get();
        $finished = Duel::query()->where('status', 'finished')->where(fn (Builder $q) => $q->where('challenger_id', $user->id)->orWhere('opponent_id', $user->id));

        return Inertia::render('duels/index', [
            'duels' => $duels->map(fn (Duel $d) => $this->duelCard($d, $user))->values()->all(),
            'stats' => ['wins' => (clone $finished)->where('winner_id', $user->id)->count(), 'losses' => (clone $finished)->where('winner_id', '!=', $user->id)->count()],
            'games' => Game::query()->where('is_published', true)->orderByDesc('popularity')->limit(80)->get(['slug', 'name'])->map(fn (Game $g) => ['slug' => $g->slug, 'name' => $g->name])->values()->all(),
            'to' => $request->query('to'),
        ]);
    }

    public function challenge(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('duels');
        $data = $request->validate([
            'username' => ['required', 'string', 'max:40'],
            'game' => ['nullable', 'string', 'max:120'],
            'terms' => ['required', 'string', 'min:3', 'max:160'],
        ]);
        $user = $request->user();
        $opponent = User::query()->where('username', ltrim(trim($data['username']), '@'))->first();
        if ($opponent === null || $opponent->is($user) || $opponent->banned_at !== null) {
            throw ValidationException::withMessages(['username' => 'Такого суперника не знайдено.']);
        }
        abort_if(Duel::query()->where('challenger_id', $user->id)->where('status', 'pending')->count() >= 10, 422, 'Забагато викликів чекають відповіді.');
        $game = ($data['game'] ?? null) ? Game::query()->where('slug', $data['game'])->first() : null;
        $duel = Duel::query()->create(['game_id' => $game?->id, 'challenger_id' => $user->id, 'opponent_id' => $opponent->id, 'terms' => trim($data['terms'])]);
        $opponent->notify(new AccountNotice('duel', $user, $user->name.' викликає вас на дуель'.($game ? ' у '.$game->name : ''), $duel->terms, '/duels'));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Виклик надіслано.']);

        return back();
    }

    /** accept / decline / cancel / report (вказати переможця). */
    public function act(Request $request, Duel $duel): RedirectResponse
    {
        $user = $request->user();
        abort_if($user->id !== $duel->challenger_id && $user->id !== $duel->opponent_id, 403);
        $data = $request->validate(['action' => ['required', Rule::in(['accept', 'decline', 'cancel', 'report'])], 'winner' => ['nullable', 'integer']]);
        $other = $user->id === $duel->challenger_id ? $duel->opponent : $duel->challenger;

        $action = (string) $data['action'];
        match ($action) {
            'accept', 'decline' => abort_unless($duel->status === 'pending' && $user->id === $duel->opponent_id, 422, 'Цей виклик уже не чекає відповіді.'),
            'cancel' => abort_unless($duel->status === 'pending' && $user->id === $duel->challenger_id, 422, 'Скасувати можна лише свій виклик до відповіді.'),
            default => abort_unless(in_array($duel->status, ['accepted', 'disputed'], true) && in_array((int) ($data['winner'] ?? 0), [$duel->challenger_id, $duel->opponent_id], true), 422, 'Оберіть переможця.'),
        };

        if ($data['action'] === 'report') {
            $duel->forceFill([$user->id === $duel->challenger_id ? 'challenger_pick' : 'opponent_pick' => (int) $data['winner']]);
            if ($duel->challenger_pick !== null && $duel->opponent_pick !== null) {
                $agreed = $duel->challenger_pick === $duel->opponent_pick;
                $duel->forceFill(['status' => $agreed ? 'finished' : 'disputed', 'winner_id' => $agreed ? $duel->challenger_pick : null]);
            }
            $duel->save();
            $other?->notify(new AccountNotice('duel', $user, $duel->status === 'finished' ? 'Дуель завершено' : ($duel->status === 'disputed' ? 'Ви вказали різних переможців дуелі' : $user->name.' вказав результат дуелі'), $duel->terms, '/duels'));
        } else {
            $duel->update(['status' => ['accept' => 'accepted', 'decline' => 'declined', 'cancel' => 'cancelled'][$data['action']]]);
            if ($data['action'] !== 'cancel') {
                $other?->notify(new AccountNotice('duel', $user, $user->name.($data['action'] === 'accept' ? ' приймає виклик' : ' відмовляється від дуелі'), $duel->terms, '/duels'));
            }
        }

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function duelCard(Duel $duel, User $viewer): array
    {
        $mine = $viewer->id === $duel->challenger_id;

        return [
            'id' => $duel->id,
            'terms' => $duel->terms,
            'status' => $duel->status,
            'game' => $duel->game ? ['slug' => $duel->game->slug, 'name' => $duel->game->name] : null,
            'challenger' => $duel->challenger?->toCard(),
            'opponent' => $duel->opponent?->toCard(),
            'incoming' => ! $mine,
            'my_pick' => $mine ? $duel->challenger_pick : $duel->opponent_pick,
            'winner_id' => $duel->winner_id,
            'created_at' => $duel->created_at->toIso8601String(),
        ];
    }
}
