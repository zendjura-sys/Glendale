<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\User;
use App\Services\Games\Backlog;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Беклог ігор: стан гри на її сторінці, своя дошка й дошка друга. */
class GameBacklogController extends Controller
{
    public function __construct(private readonly Plugins $plugins, private readonly Backlog $backlog) {}

    /** Своя дошка «хочу — граю — пройшов — кинув» і в що зараз грають друзі. */
    public function mine(Request $request): Response|JsonResponse
    {
        $this->plugins->ensure('game_backlog');
        $user = $this->user($request);

        return $this->render($request, $user, $user);
    }

    /** Дошка іншої людини — лише перегляд; закритий профіль бачать друзі. */
    public function show(Request $request, User $user): Response|JsonResponse
    {
        $this->plugins->ensure('game_backlog');
        $viewer = $this->user($request);
        abort_unless($this->backlog->canView($user, $viewer) && ! $user->isFrozen(), 404);

        return $this->render($request, $user, $viewer);
    }

    /** Новий стан гри або null — прибрати з беклогу. */
    public function update(Request $request, Game $game): JsonResponse
    {
        $this->plugins->ensure('game_backlog');
        abort_unless($game->is_published, 404);
        $data = $request->validate(['status' => ['present', 'nullable', Rule::in(GameBacklog::STATUSES)]]);
        $user = $this->user($request);
        $this->backlog->set($user, $game, $data['status']);

        return response()->json(['status' => $data['status'], 'counts' => $this->backlog->summary($user)['counts']]);
    }

    private function render(Request $request, User $owner, User $viewer): Response|JsonResponse
    {
        $mine = $owner->is($viewer);
        $props = [
            'owner' => $owner->toCard(),
            'mine' => $mine,
            'board' => $this->backlog->board($owner),
            'friends' => $mine ? $this->backlog->friendsPlaying($viewer) : [],
        ];
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json($props);
        }

        return Inertia::render('games/backlog', $props);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
