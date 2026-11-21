<?php

namespace App\Http\Controllers;

use App\Services\Games\SteamNews;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** «Новини моїх ігор»: патчі й анонси з бібліотеки Steam і підписок + що надсилати сповіщенням. */
class MyGameNewsController extends Controller
{
    public function index(Request $request, SteamNews $news): Response|JsonResponse
    {
        $data = $request->validate(['patches' => ['nullable', 'boolean'], 'before' => ['nullable', 'integer']]);
        $feed = $news->feed($request->user(), (bool) ($data['patches'] ?? false), isset($data['before']) ? (int) $data['before'] : null);
        $payload = [...$feed, 'mode' => SteamNews::alertsFor($request->user()), 'patches' => (bool) ($data['patches'] ?? false)];

        return $request->wantsJson() ? response()->json($payload) : Inertia::render('games/news', $payload);
    }

    public function prefs(Request $request): RedirectResponse|JsonResponse
    {
        $mode = $request->validate(['mode' => ['required', Rule::in(SteamNews::ALERT_MODES)]])['mode'];
        $request->user()->mergePref(['patch_alerts' => $mode]);

        return $request->wantsJson() ? response()->json(['mode' => $mode]) : back()->with('success', 'Збережено.');
    }
}
