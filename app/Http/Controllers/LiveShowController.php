<?php

namespace App\Http\Controllers;

use App\Models\LiveShow;
use App\Models\User;
use App\Services\Shows\LiveShows;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Шоу наживо: стрічка «Зараз в ефірі» й розклад, створення, сцена з ведучими, гості з питанням на таймері.
 */
class LiveShowController extends Controller
{
    public function __construct(private readonly LiveShows $shows) {}

    public function index(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');
        $live = LiveShow::query()->where('status', LiveShow::LIVE)->latest('started_at')->limit(30)->get()
            ->map(fn (LiveShow $s) => $this->shows->card($s))->sortByDesc('listeners')->values();
        $upcoming = LiveShow::query()->where('status', LiveShow::SCHEDULED)->where('scheduled_at', '>=', now()->subHour())
            ->orderBy('scheduled_at')->limit(30)->get()->map(fn (LiveShow $s) => $this->shows->card($s))->values();
        $user = $request->user();
        $mine = $user ? LiveShow::query()->where('host_id', $user->id)->where('status', '!=', LiveShow::ENDED)->pluck('id') : collect();
        $data = ['live' => $live, 'upcoming' => $upcoming, 'mine' => $mine, 'formats' => LiveShow::FORMATS];

        return $request->expectsJson() ? response()->json($data) : Inertia::render('shows/index', $data);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'topic' => ['nullable', 'string', 'max:30', 'regex:/^#?[\pL\pN_]+$/u'],
            'format' => ['required', Rule::in(array_keys(LiveShow::FORMATS))],
            'stage_seats' => ['nullable', 'integer', 'min:1', 'max:8'],
            'guest_seats' => ['nullable', 'integer', 'min:0', 'max:4'],
            'question_seconds' => ['nullable', 'integer', 'min:30', 'max:300'],
            'scheduled_at' => ['nullable', 'date', 'before:+30 days'],
        ], ['topic.regex' => 'Тема — одне слово без пробілів, як хештег.']);
        $user = $request->user();
        $active = LiveShow::query()->where('host_id', $user->id)->where('status', LiveShow::LIVE)->exists();
        abort_if($active && empty($data['scheduled_at']), 422, 'У вас уже є шоу в ефірі — завершіть його спершу.');

        $show = $this->shows->create($user, $data);

        return $request->expectsJson()
            ? response()->json(['show' => $this->shows->card($show)], 201)
            : redirect("/shows/{$show->id}");
    }

    public function show(Request $request, LiveShow $show): Response|JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');
        $data = $this->shows->state($show, $request->user());

        return $request->expectsJson() ? response()->json($data) : Inertia::render('shows/show', $data);
    }

    /** Опитування стану кожні кілька секунд — і відмітка «я ще тут». */
    public function state(Request $request, LiveShow $show): JsonResponse
    {
        return response()->json($this->shows->state($show, $request->user()));
    }

    public function join(Request $request, LiveShow $show): JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');

        return response()->json($this->shows->join($show, $request->user()));
    }

    public function leave(Request $request, LiveShow $show): JsonResponse
    {
        $this->shows->leave($show, $request->user());

        return response()->json(['ok' => true]);
    }

    public function hand(Request $request, LiveShow $show): JsonResponse
    {
        $this->shows->hand($show, $request->user(), $request->boolean('raised'));

        return response()->json($this->shows->state($show, $request->user()));
    }

    /** Ведучий чи співведучий дає гостю слово на хвилину (або скільки задано). */
    public function floor(Request $request, LiveShow $show, User $user): JsonResponse
    {
        abort_unless($this->shows->isStage($show, $request->user()), 403);
        $this->shows->giveFloor($show, $user);

        return response()->json($this->shows->state($show, $request->user()));
    }

    public function unfloor(Request $request, LiveShow $show, User $user): JsonResponse
    {
        abort_unless($this->shows->isStage($show, $request->user()) || $request->user()->id === $user->id, 403);
        $this->shows->takeFloor($show, $user);

        return response()->json($this->shows->state($show, $request->user()));
    }

    public function addSpeaker(Request $request, LiveShow $show): JsonResponse
    {
        abort_unless($this->shows->isHost($show, $request->user()), 403);
        $data = $request->validate(['username' => ['required', 'string', 'max:40']]);
        $target = User::query()->where('username', ltrim($data['username'], '@'))->first();
        abort_if($target === null, 422, 'Людину з таким ніком не знайдено.');
        $this->shows->addSpeaker($show, $target);

        return response()->json($this->shows->state($show, $request->user()));
    }

    public function removeSpeaker(Request $request, LiveShow $show, User $user): JsonResponse
    {
        abort_unless($this->shows->isHost($show, $request->user()) || $request->user()->id === $user->id, 403);
        $this->shows->removeSpeaker($show, $user);

        return response()->json($this->shows->state($show, $request->user()));
    }

    public function start(Request $request, LiveShow $show): JsonResponse
    {
        abort_unless($this->shows->isHost($show, $request->user()), 403);
        $this->shows->start($show);

        return response()->json($this->shows->state($show, $request->user()));
    }

    /** Завершити: ведучий або персонал (персонал — із записом у журнал). */
    public function end(Request $request, LiveShow $show): JsonResponse
    {
        $user = $request->user();
        $host = $this->shows->isHost($show, $user);
        abort_unless($host || $user->isStaff(), 403);
        $this->shows->end($show);
        if (! $host) {
            Log::info('shows: ended by staff', ['show' => $show->id, 'host' => $show->host_id, 'by' => $user->id]);
        }

        return response()->json($this->shows->state($show, $user));
    }
}
