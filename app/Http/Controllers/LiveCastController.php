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
 * LiveCast — нативні відеостріми.
 * Вихід в ефір лише з застосунку (api/*); веб — перегляд, чат, подарунки, донати.
 */
class LiveCastController extends Controller
{
    public function __construct(private readonly LiveCastService $streams) {}

    public function index(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $this->streams->catalog();

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
        abort_unless(
            $this->fromApp($request),
            403,
            'Стрімити можна лише з застосунку GameCon. На сайті — перегляд, чат і подарунки.',
        );
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'category' => ['nullable', 'string', 'max:60'],
            'donations' => ['nullable', 'array', 'max:2'],
            'donations.*.provider' => ['required_with:donations', 'string', 'in:donatik,donatello'],
            'donations.*.url' => ['required_with:donations', 'string', 'max:500'],
        ]);
        $stream = $this->streams->start(
            $request->user(),
            $data['title'],
            $data['category'] ?? null,
            $data['donations'] ?? [],
        );

        return $request->expectsJson()
            ? response()->json(['broadcast' => $this->streams->card($stream)], 201)
            : redirect('/livecast/'.$stream->id);
    }

    public function show(Request $request, Livecast $livecast): Response|JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $this->streams->state($livecast, $request->user(), $this->fromApp($request));

        return $request->expectsJson()
            ? response()->json($data)
            : Inertia::render('livecast/show', $data);
    }

    public function state(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');

        return response()->json($this->streams->state($livecast, $request->user(), $this->fromApp($request)));
    }

    public function join(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $fromApp = $this->fromApp($request);
        $isHost = $livecast->host_id === $request->user()->id;

        return response()->json($this->streams->join($livecast, $request->user(), $fromApp && $isHost));
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

        return response()->json($this->streams->state($livecast->fresh(), $request->user(), $this->fromApp($request)));
    }

    public function message(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $request->validate(['body' => ['required', 'string', 'max:280']]);
        $this->streams->chat($livecast, $request->user(), $data['body']);

        return response()->json($this->streams->state($livecast, $request->user(), $this->fromApp($request)));
    }

    public function gift(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $request->validate([
            'gift' => ['required', 'string', 'max:32'],
            'note' => ['nullable', 'string', 'max:120'],
        ]);
        $this->streams->gift($livecast, $request->user(), $data['gift'], $data['note'] ?? null);

        return response()->json($this->streams->state($livecast, $request->user(), $this->fromApp($request)));
    }

    public function donations(Request $request, Livecast $livecast): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $data = $request->validate([
            'donations' => ['present', 'array', 'max:2'],
            'donations.*.provider' => ['required', 'string', 'in:donatik,donatello'],
            'donations.*.url' => ['required', 'string', 'max:500'],
        ]);
        $stream = $this->streams->updateDonations($livecast, $request->user(), $data['donations']);

        return response()->json($this->streams->state($stream, $request->user(), $this->fromApp($request)));
    }

    /** Застосунок ходить на /api/v1/site/…; сайт — на /livecast. */
    private function fromApp(Request $request): bool
    {
        return $request->is('api/*')
            || str_contains((string) $request->userAgent(), 'Flutter');
    }
}
