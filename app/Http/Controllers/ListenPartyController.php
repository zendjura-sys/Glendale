<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ListenParty;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\ListenParties;
use App\Services\Music\ListenRooms;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Спільне прослуховування: створити, синхронізувати плеєр, спільна черга, запросити друзів або чат.
 */
class ListenPartyController extends Controller
{
    public function __construct(private readonly ListenParties $parties) {}

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'track_id' => ['nullable', 'integer'],
            'conversation_id' => ['nullable', 'integer'],
        ]);
        $track = isset($data['track_id']) ? Track::query()->findOrFail((int) $data['track_id']) : null;

        $party = $this->parties->create($user, $track);
        if (isset($data['conversation_id'])) {
            $this->parties->share($party, $user, Conversation::query()->findOrFail((int) $data['conversation_id']));
        }

        return $request->expectsJson()
            ? response()->json(['code' => $party->code, 'url' => url('/listen/'.$party->code)], 201)
            : to_route('listen.show', $party);
    }

    public function show(Request $request, ListenParty $party, FriendshipService $friendships): Response|JsonResponse
    {
        $user = $this->user($request);
        app(ListenRooms::class)->ensureCanJoin($party, $user);
        if ($party->isLive()) {
            $this->parties->touch($party, $user);
        }

        $props = [
            'party' => $this->parties->state($party, $user),
            'friends' => $friendships->friendsQuery($user)->orderBy('first_name')->limit(100)->get()->map(fn (User $f) => $f->toCard())->values(),
        ];

        return $request->expectsJson() ? response()->json($props) : Inertia::render('music/together', $props);
    }

    /** Стан для застосунку (опитування) і як сигнал «я ще тут». */
    public function poll(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->member($request, $party);
        if ($party->isLive()) {
            $this->parties->touch($party, $user);
        }

        return response()->json($this->parties->state($party, $user));
    }

    public function control(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate([
            'playing' => ['required', 'boolean'],
            'position' => ['required', 'numeric', 'min:0', 'max:86400'],
            'track_id' => ['nullable', 'integer'],
            'station_id' => ['nullable', 'integer'],
        ]);
        $track = isset($data['track_id']) ? Track::query()->findOrFail((int) $data['track_id']) : null;
        $station = isset($data['station_id']) ? RadioStation::query()->where('is_active', true)->findOrFail((int) $data['station_id']) : null;
        $this->parties->control($party, $user, (bool) $data['playing'], (float) $data['position'], $track, $station);

        return response()->json(['state' => $this->parties->playback($party->refresh())]);
    }

    public function enqueue(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['track_id' => ['required_without:station_id', 'nullable', 'integer'], 'station_id' => ['nullable', 'integer']]);
        $item = isset($data['station_id'])
            ? RadioStation::query()->where('is_active', true)->findOrFail((int) $data['station_id'])
            : Track::query()->findOrFail((int) $data['track_id']);
        $this->parties->enqueue($party, $user, $item);

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    public function dequeue(Request $request, ListenParty $party, int $index): JsonResponse
    {
        $user = $this->live($request, $party);
        $this->parties->dequeue($party, $user, $index);

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    public function next(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $this->parties->next($party, $user);

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    public function repeat(Request $request, ListenParty $party): JsonResponse
    {
        app(Plugins::class)->ensure('listen_repeat');
        $user = $this->live($request, $party);
        $this->parties->setRepeat($party, $user, $request->boolean('repeat'));

        return response()->json(['state' => $this->parties->playback($party->refresh())]);
    }

    public function shared(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $this->parties->setSharedControl($party, $user, $request->boolean('shared'));

        return response()->json(['state' => $this->parties->playback($party->refresh())]);
    }

    public function invite(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['user_ids' => ['required', 'array', 'min:1', 'max:20'], 'user_ids.*' => ['integer']]);

        return response()->json(['sent' => $this->parties->invite($party, $user, array_values(array_map('intval', $data['user_ids'])))]);
    }

    public function share(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['conversation_id' => ['required', 'integer']]);
        $this->parties->share($party, $user, Conversation::query()->findOrFail((int) $data['conversation_id']));

        return response()->json(['ok' => true]);
    }

    public function end(Request $request, ListenParty $party): JsonResponse
    {
        $this->parties->end($party, $this->live($request, $party));

        return response()->json(['ok' => true]);
    }

    private function member(Request $request, ListenParty $party): User
    {
        $user = $this->user($request);
        app(ListenRooms::class)->ensureCanJoin($party, $user);
        abort_unless($this->parties->isMember($party, $user), 403, 'Відкрийте посилання, щоб приєднатися.');

        return $user;
    }

    private function live(Request $request, ListenParty $party): User
    {
        $user = $this->member($request, $party);
        abort_unless($party->isLive(), 410, 'Прослуховування вже завершено.');

        return $user;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
