<?php

namespace App\Http\Controllers;

use App\Services\Quests\DailyQuests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Щоденні завдання й таблиця сезону. */
class QuestController extends Controller
{
    public function __construct(private readonly DailyQuests $quests) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('quests/index', [
            'quests' => $this->quests->board($user),
            'season' => $this->quests->leaderboard($user),
            'completed' => $this->quests->completed($user),
            'resets_at' => $this->quests->today()->addDay()->toIso8601String(),
        ]);
    }

    public function claim(Request $request, string $quest): RedirectResponse
    {
        $xp = $this->quests->claim($request->user(), $quest);
        Inertia::flash('toast', ['type' => 'success', 'message' => "+{$xp} XP — завдання виконано!"]);

        return back();
    }
}
