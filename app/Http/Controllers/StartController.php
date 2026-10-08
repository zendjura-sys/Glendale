<?php

namespace App\Http\Controllers;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GtaServer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StartController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('start/index', [
            'games' => Game::query()->published()->orderByDesc('popularity')->limit(18)->get()->map->toCard()->values(),
            'servers' => GtaServer::query()->published()->orderByDesc('players_online')->limit(12)->get()->map->toCard()->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'games' => ['array', 'max:8'],
            'games.*' => ['integer'],
            'servers' => ['array', 'max:8'],
            'servers.*' => ['integer'],
        ]);
        $user = $request->user();
        foreach (Game::query()->published()->whereIn('id', $data['games'] ?? [])->pluck('id') as $id) {
            Follow::query()->firstOrCreate(['user_id' => $user->id, 'kind' => Follow::GAME, 'subject_id' => $id]);
        }
        foreach (GtaServer::query()->published()->whereIn('id', $data['servers'] ?? [])->pluck('id') as $id) {
            Follow::query()->firstOrCreate(['user_id' => $user->id, 'kind' => Follow::SERVER, 'subject_id' => $id]);
        }
        $user->mergePref(['onboarded' => true]);

        return redirect()->route('feed');
    }

    public function skip(Request $request): RedirectResponse
    {
        $request->user()->mergePref(['onboarded' => true]);

        return redirect()->route('feed');
    }
}
