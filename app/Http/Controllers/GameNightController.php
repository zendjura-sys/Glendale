<?php

namespace App\Http\Controllers;

use App\Models\GameNight;
use App\Models\GameNightOption;
use App\Models\User;
use App\Notifications\GameNightNotice;
use App\Services\FriendshipService;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Ігровий вечір: організатор кличе друзів, усі голосують за час і гру, організатор призначає. */
class GameNightController extends Controller
{
    public function __construct(private readonly FriendshipService $friendships) {}

    public function index(Request $request): Response
    {
        app(Plugins::class)->ensure('game_nights');
        $user = $request->user();
        $ids = DB::table('game_night_members')->where('user_id', $user->id)->pluck('game_night_id');
        $nights = GameNight::query()->with(['user', 'game'])->withCount('members')
            ->where(fn ($q) => $q->where('user_id', $user->id)->orWhereIn('id', $ids))
            ->where('status', '!=', 'cancelled')
            ->latest('id')->limit(50)->get();
        $now = now();

        return Inertia::render('game-nights/index', [
            'upcoming' => $nights->filter(fn (GameNight $n) => $n->status === 'planning' || ($n->starts_at?->gt($now->copy()->subHours(6)) ?? false))->map(fn (GameNight $n) => $this->summary($n))->values(),
            'past' => $nights->filter(fn (GameNight $n) => $n->status === 'set' && ($n->starts_at?->lte($now->copy()->subHours(6)) ?? false))->map(fn (GameNight $n) => $this->summary($n))->values(),
            'friends' => $this->friendCards($user),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('game_nights');
        $user = $request->user();
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'note' => ['nullable', 'string', 'max:500'],
            'friends' => ['required', 'array', 'min:1', 'max:20'],
            'friends.*' => ['integer'],
            'times' => ['required', 'array', 'min:1', 'max:6'],
            'times.*' => ['date', 'after:now'],
            'games' => ['nullable', 'array', 'max:6'],
            'games.*' => ['integer', Rule::exists('games', 'id')],
        ]);
        $friends = array_values(array_intersect(array_map('intval', $data['friends']), $this->friendships->friendIds($user)));
        if ($friends === []) {
            throw ValidationException::withMessages(['friends' => 'Оберіть когось із друзів.']);
        }
        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($user);

        $night = DB::transaction(function () use ($user, $data, $friends, $filter) {
            $night = GameNight::query()->create([
                'user_id' => $user->id,
                'title' => (string) $filter->clean(trim($data['title'])),
                'note' => $filter->clean(trim((string) ($data['note'] ?? '')) ?: null),
            ]);
            $night->members()->attach($friends, ['status' => 'invited']);
            foreach (array_unique(array_map(fn ($t) => Carbon::parse($t)->toIso8601String(), $data['times'])) as $time) {
                $night->options()->create(['kind' => 'time', 'starts_at' => Carbon::parse($time)]);
            }
            foreach (array_unique(array_map('intval', $data['games'] ?? [])) as $gameId) {
                $night->options()->create(['kind' => 'game', 'game_id' => $gameId]);
            }

            return $night;
        });
        foreach (User::query()->whereIn('id', $friends)->get() as $friend) {
            $friend->notify(new GameNightNotice($user, $night, 'invite'));
        }

        return to_route('game-nights.show', $night);
    }

    public function show(Request $request, GameNight $night): Response
    {
        app(Plugins::class)->ensure('game_nights');
        $user = $request->user();
        abort_unless($night->involves($user), 404);

        return Inertia::render('game-nights/show', ['night' => $this->full($night, $user)]);
    }

    /** Голос за варіант часу чи гри — увімкнути або зняти. */
    public function vote(Request $request, GameNight $night, GameNightOption $option): RedirectResponse
    {
        app(Plugins::class)->ensure('game_nights');
        $user = $request->user();
        abort_unless($night->involves($user) && $option->game_night_id === $night->id, 404);
        abort_unless($night->status === 'planning', 422, 'Вечір уже призначено.');
        $query = DB::table('game_night_votes')->where('game_night_option_id', $option->id)->where('user_id', $user->id);
        $query->exists() ? $query->delete() : DB::table('game_night_votes')->insert(['game_night_option_id' => $option->id, 'user_id' => $user->id]);

        return back();
    }

    /** Запрошений: «Буду» чи «Не зможу». */
    public function respond(Request $request, GameNight $night): RedirectResponse
    {
        app(Plugins::class)->ensure('game_nights');
        $data = $request->validate(['status' => ['required', Rule::in(['going', 'declined'])]]);
        $user = $request->user();
        abort_unless($night->members()->whereKey($user->id)->exists(), 404);
        $night->members()->updateExistingPivot($user->id, ['status' => $data['status']]);

        return back();
    }

    /** Організатор призначає час (і гру) — запрошені отримують сповіщення. */
    public function finalize(Request $request, GameNight $night): RedirectResponse
    {
        app(Plugins::class)->ensure('game_nights');
        $user = $request->user();
        abort_unless($night->user_id === $user->id, 403);
        $data = $request->validate([
            'time' => ['required', 'integer'],
            'game' => ['nullable', 'integer'],
        ]);
        $time = $night->options()->where('kind', 'time')->whereKey($data['time'])->first();
        $game = isset($data['game']) ? $night->options()->where('kind', 'game')->whereKey($data['game'])->first() : null;
        if ($time === null || (isset($data['game']) && $game === null)) {
            throw ValidationException::withMessages(['time' => 'Такого варіанта немає.']);
        }
        $night->forceFill(['status' => 'set', 'starts_at' => $time->starts_at, 'game_id' => $game?->game_id])->save();
        foreach ($night->members()->wherePivot('status', '!=', 'declined')->get() as $member) {
            $member->notify(new GameNightNotice($user, $night, 'set'));
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вечір призначено — друзі отримали сповіщення.']);

        return back();
    }

    public function cancel(Request $request, GameNight $night): RedirectResponse
    {
        app(Plugins::class)->ensure('game_nights');
        abort_unless($night->user_id === $request->user()->id, 403);
        $night->forceFill(['status' => 'cancelled'])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вечір скасовано.']);

        return to_route('game-nights.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(GameNight $night): array
    {
        return [
            'id' => $night->id,
            'title' => $night->title,
            'status' => $night->status,
            'starts_at' => $night->starts_at?->toIso8601String(),
            'game' => $night->game?->toCard(),
            'host' => $night->user?->toCard(),
            'members_count' => (int) ($night->members_count ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function full(GameNight $night, User $viewer): array
    {
        $night->load(['user', 'game', 'members', 'options.game']);
        $votes = DB::table('game_night_votes')->whereIn('game_night_option_id', $night->options->pluck('id'))->get(['game_night_option_id', 'user_id']);
        $voters = User::query()->whereIn('id', $votes->pluck('user_id')->unique())->get()->keyBy('id');
        $option = function (GameNightOption $o) use ($votes, $voters, $viewer) {
            $ids = $votes->where('game_night_option_id', $o->id)->pluck('user_id');

            return [
                'id' => $o->id,
                'starts_at' => $o->starts_at?->toIso8601String(),
                'game' => $o->game?->toCard(),
                'votes' => $ids->count(),
                'voted' => $ids->contains($viewer->id),
                'voters' => $ids->map(fn ($id) => $voters->get($id)?->toCard())->filter()->values(),
            ];
        };

        // Статуси запрошених («запрошено», «буде», «не зможе») — з таблиці учасників.
        $statuses = DB::table('game_night_members')->where('game_night_id', $night->id)->pluck('status', 'user_id');

        return [
            ...$this->summary($night->loadCount('members')),
            'note' => $night->note,
            'is_host' => $night->user_id === $viewer->id,
            'my_status' => $statuses->get($viewer->id),
            'members' => $night->members->map(fn (User $m) => [...$m->toCard(), 'status' => $statuses->get($m->id, 'invited')])->values(),
            'times' => $night->options->where('kind', 'time')->sortBy('starts_at')->map($option)->values(),
            'games' => $night->options->where('kind', 'game')->map($option)->values(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function friendCards(User $user): array
    {
        return array_values(User::query()->whereIn('id', $this->friendships->friendIds($user))->orderBy('name')->limit(200)->get()
            ->map(fn (User $u) => $u->toCard())->all());
    }
}
