<?php

namespace App\Http\Controllers;

use App\Models\Livecast;
use App\Services\Broadcasts\LiveCastService;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * LiveCast — нативні відеостріми (окремо від GameCast і Twitch/YouTube).
 */
class LiveCastController extends Controller
{
    public function __construct(private readonly LiveCastService $streams) {}

    public function index(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = [
            'live' => $this->streams->live(),
            'pulse' => $this->streams->pulse(),
        ];

        return $request->expectsJson()
            ? response()->json($data)
            : Inertia::render('livecast/index', $data);
    }

    public function pulse(): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');

        return response()->json($this->streams->pulse());
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'category' => ['nullable', 'string', 'max:60'],
        ]);
        $stream = $this->streams->start($request->user(), $data['title'], $data['category'] ?? null);

        return $request->expectsJson()
            ? response()->json(['broadcast' => $this->streams->card($stream)], 201)
            : redirect('/livecast/'.$stream->id);
    }

    public function show(Request $request, Livecast $livecast): Response|JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $this->streams->state($livecast, $request->user());

        return $request->expectsJson()
            ? response()->json($data)
            : Inertia::render('livecast/show', $data);
    }

    public function state(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');

        return response()->json($this->streams->state($livecast, $request->user()));
    }

    public function join(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');

        return response()->json($this->streams->join($livecast, $request->user()));
    }

    public function leave(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $this->streams->leave($livecast, $request->user());

        return response()->json(['ok' => true]);
    }

    public function end(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $this->streams->end($livecast, $request->user());

        return response()->json($this->streams->state($livecast->fresh(), $request->user()));
    }

    public function message(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $request->validate(['body' => ['required', 'string', 'max:280']]);
        $this->streams->chat($livecast, $request->user(), $data['body']);

        return response()->json($this->streams->state($livecast, $request->user()));
    }
}
