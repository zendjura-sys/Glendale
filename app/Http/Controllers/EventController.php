<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\User;
use App\Services\EventCalendar;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Календар: найближчі події сімей, кланів, серверів та ігор; події серверів та ігор створюються тут.
 */
class EventController extends Controller
{
    public const KINDS = ['family' => 'Сім’ї', 'clan' => 'Клани', 'server' => 'Сервери', 'game' => 'Ігри'];

    public function __construct(private readonly EventCalendar $calendar) {}

    public function index(Request $request): Response|JsonResponse
    {
        $data = $request->validate(['kind' => ['nullable', Rule::in(array_keys(self::KINDS))]]);
        $props = [
            'events' => $this->calendar->upcoming($this->user($request), $data['kind'] ?? null),
            'kind' => $data['kind'] ?? null,
            'kinds' => self::KINDS,
        ];

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($props)
            : Inertia::render('events/index', $props);
    }

    public function storeServer(Request $request, GtaServer $server): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(array_keys(ServerEvent::TYPES))],
            'description' => ['nullable', 'string', 'max:1000'],
            'starts_at' => ['required', 'date'],
            'family_id' => ['nullable', 'integer'],
        ]);
        // Час із форми — київський; з часовим поясом (застосунок) — як є.
        $startsAt = Carbon::instance(CarbonImmutable::parse((string) $data['starts_at'], 'Europe/Kyiv')->utc()->toMutable());
        if ($startsAt->lt(now())) {
            return back()->withErrors(['starts_at' => 'Подія має бути в майбутньому.']);
        }
        $this->calendar->createServerEvent($server, $this->user($request), [
            'title' => trim((string) $data['title']),
            'type' => (string) $data['type'],
            'description' => isset($data['description']) ? trim((string) $data['description']) : null,
            'starts_at' => $startsAt,
            'family_id' => isset($data['family_id']) ? (int) $data['family_id'] : null,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію додано в календар сервера.']);

        return back();
    }

    public function rsvpServer(Request $request, ServerEvent $event): RedirectResponse
    {
        $data = $request->validate(['going' => ['required', 'boolean']]);
        $this->calendar->rsvp($event, $this->user($request), (bool) $data['going']);
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['going'] ? 'Ви йдете ✅' : 'Позначено: не піду']);

        return back();
    }

    public function destroyServer(Request $request, ServerEvent $event): RedirectResponse
    {
        $this->calendar->deleteServerEvent($event, $this->user($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію видалено.']);

        return back();
    }

    public function storeGame(Request $request, Game $game): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'type' => ['required', Rule::in(array_keys(GameEvent::TYPES))],
            'description' => ['nullable', 'string', 'max:1000'],
            'starts_at' => ['required', 'date'],
            'url' => ['nullable', 'string', 'max:500', 'url:https'],
        ]);
        $startsAt = Carbon::instance(CarbonImmutable::parse((string) $data['starts_at'], 'Europe/Kyiv')->utc()->toMutable());
        if ($startsAt->lt(now())) {
            return back()->withErrors(['starts_at' => 'Подія має бути в майбутньому.']);
        }
        $this->calendar->createGameEvent($game, $this->user($request), [
            'title' => trim((string) $data['title']),
            'type' => (string) $data['type'],
            'description' => isset($data['description']) ? trim((string) $data['description']) : null,
            'starts_at' => $startsAt,
            'url' => isset($data['url']) ? (string) $data['url'] : null,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію гри додано в календар.']);

        return back();
    }

    public function rsvpGame(Request $request, GameEvent $event): RedirectResponse
    {
        $data = $request->validate(['going' => ['required', 'boolean']]);
        $this->calendar->rsvpGame($event, $this->user($request), (bool) $data['going']);
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['going'] ? 'Додано у ваш календар — нагадаємо ✅' : 'Позначено: не цікаво']);

        return back();
    }

    public function destroyGame(Request $request, GameEvent $event): RedirectResponse
    {
        $this->calendar->deleteGameEvent($event, $this->user($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію видалено.']);

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
