<?php

namespace App\Http\Controllers;

use App\Models\Movie;
use App\Models\User;
use App\Models\WatchParty;
use App\Services\Cinema\CinemaService;
use App\Services\Cinema\WatchParties;
use App\Services\FriendshipService;
use App\Services\Voice\LiveKit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Спільний перегляд фільму: створити кімнату, синхронізувати плеєр, чат, голос, запрошення друзів.
 */
class WatchPartyController extends Controller
{
    public function __construct(
        private readonly WatchParties $parties,
        private readonly CinemaService $cinema,
    ) {}

    public function store(Request $request, Movie $movie): RedirectResponse|JsonResponse
    {
        $user = $this->user($request);
        abort_unless($movie->is_published || $user->isStaff(), 404);
        $data = $request->validate(['player_key' => ['nullable', 'string', 'max:64']]);

        $party = $this->parties->create($movie, $user, $data['player_key'] ?? null);

        return $request->expectsJson()
            ? response()->json(['code' => $party->code, 'url' => url('/watch/'.$party->code)], 201)
            : to_route('watch.show', $party);
    }

    public function show(Request $request, WatchParty $party, FriendshipService $friendships): Response|JsonResponse
    {
        $user = $this->user($request);
        $movie = $party->movie;
        abort_unless($movie instanceof Movie, 404);
        if ($party->isLive()) {
            $this->parties->touch($party, $user);
        }
        $movie->load('sources');

        $props = [
            'movie' => $movie->toCard(),
            'players' => $this->cinema->players($movie, $user),
            'party' => $this->parties->state($party, $user),
            'friends' => $friendships->friendsQuery($user)->orderBy('first_name')->limit(100)->get()->map(fn (User $f) => $f->toCard())->values(),
        ];

        return $request->expectsJson() ? response()->json($props) : Inertia::render('cinema/watch', $props);
    }

    /** Стан для застосунку (опитування) і як сигнал «я ще тут». */
    public function poll(Request $request, WatchParty $party): JsonResponse
    {
        $user = $this->member($request, $party);
        if ($party->isLive()) {
            $this->parties->touch($party, $user);
        }

        return response()->json($this->parties->state($party, $user, $request->integer('after')));
    }

    public function control(Request $request, WatchParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate([
            'playing' => ['required', 'boolean'],
            'position' => ['required', 'numeric', 'min:0', 'max:86400'],
            'player_key' => ['nullable', 'string', 'max:64'],
        ]);
        $this->parties->control($party, $user, (bool) $data['playing'], (float) $data['position'], $data['player_key'] ?? null);

        return response()->json(['state' => $this->parties->playback($party->refresh())]);
    }

    public function shared(Request $request, WatchParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $this->parties->setSharedControl($party, $user, $request->boolean('shared'));

        return response()->json(['state' => $this->parties->playback($party->refresh())]);
    }

    public function message(Request $request, WatchParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['body' => ['required', 'string', 'max:500']]);
        $message = $this->parties->say($party, $user, trim($data['body']));

        return response()->json(['id' => $message->id], 201);
    }

    public function voice(Request $request, WatchParty $party, LiveKit $livekit): JsonResponse
    {
        $user = $this->live($request, $party);
        abort_unless($livekit->configured(), 503, 'Голос ще не налаштований адміністратором.');

        return response()->json($this->parties->voice($party, $user));
    }

    public function invite(Request $request, WatchParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['user_ids' => ['required', 'array', 'min:1', 'max:20'], 'user_ids.*' => ['integer']]);

        return response()->json(['sent' => $this->parties->invite($party, $user, array_values(array_map('intval', $data['user_ids'])))]);
    }

    public function end(Request $request, WatchParty $party): JsonResponse
    {
        $this->parties->end($party, $this->live($request, $party));

        return response()->json(['ok' => true]);
    }

    private function member(Request $request, WatchParty $party): User
    {
        $user = $this->user($request);
        abort_unless($this->parties->isMember($party, $user), 403, 'Відкрийте посилання на перегляд, щоб приєднатися.');

        return $user;
    }

    private function live(Request $request, WatchParty $party): User
    {
        $user = $this->member($request, $party);
        abort_unless($party->isLive(), 410, 'Перегляд уже завершено.');

        return $user;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
