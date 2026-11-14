<?php

namespace App\Http\Controllers;

use App\Services\Streams\LiveStreams;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** «Зараз в ефірі»: стрімери GameCon, які стрімлять просто зараз (Twitch, YouTube). */
class LiveNowController extends Controller
{
    public function __invoke(Request $request, LiveStreams $streams): Response
    {
        $game = $request->query('game');
        $game = is_string($game) && $game !== '' ? mb_substr($game, 0, 120) : null;

        return Inertia::render('streams/live', [...$streams->liveNow($request->getHost(), $game), 'game' => $game]);
    }
}
