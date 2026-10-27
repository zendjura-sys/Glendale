<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\User;
use App\Services\EventCalendar;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
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
            'kinds' => array_filter(self::KINDS, fn (string $key) => app(ModuleManager::class)->enabled(EventCalendar::SOURCES[$key]), ARRAY_FILTER_USE_KEY),
            'releasesOn' => app(ModuleManager::class)->enabled('games'),
            'reminder_lead' => EventCalendar::leadOf($this->user($request)),
            'reminder_leads' => EventCalendar::REMIND_LEADS,
            // Підписка «Мій календар» (Google, Apple, Outlook): усі мої події одним посиланням.
            'feed_url' => app(Plugins::class)->on('calendar_feed') ? url('/calendar/'.$this->feedToken($this->user($request)).'.ics') : null,
        ];

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($props)
            : Inertia::render('events/index', $props);
    }

    /** Нове посилання підписки (старе перестає працювати). */
    public function resetFeed(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('calendar_feed');
        $this->user($request)->mergePref(['calendar_token' => Str::random(40)]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Посилання календаря оновлено — старе більше не працює.']);

        return back();
    }

    /**
     * Підписка «Мій календар»: події сімей, кланів, серверів та ігор людини на 30 днів уперед.
     * Без входу — за таємним токеном у посиланні.
     */
    public function feed(string $token): \Illuminate\Http\Response
    {
        abort_unless(app(Plugins::class)->on('calendar_feed') && strlen($token) === 40, 404);
        $user = User::query()->where('preferences->calendar_token', $token)->first();
        abort_if($user === null || $user->isBanned(), 404);

        $entries = [];
        foreach ($this->calendar->upcoming($user) as $item) {
            $entries[] = [
                'uid' => str_replace(':', '-', (string) $item['key']),
                'title' => (string) $item['title'],
                'description' => trim(($item['type_label'] ?? '').' · '.($item['where']['name'] ?? '').(($item['description'] ?? null) ? "\n".$item['description'] : ''), ' ·'),
                'starts_at' => CarbonImmutable::parse((string) $item['starts_at']),
                'ends_at' => isset($item['ends_at']) && $item['ends_at'] ? CarbonImmutable::parse((string) $item['ends_at']) : null,
                'all_day' => (bool) ($item['all_day'] ?? false),
                'url' => url((string) ($item['url'] ?? $item['where']['url'] ?? '/events')),
            ];
        }

        return response(EventCalendar::icsMany($entries, 'GameCon — мої події'), 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Cache-Control' => 'private, max-age=900',
        ]);
    }

    private function feedToken(User $user): string
    {
        $token = $user->pref('calendar_token');
        if (! is_string($token) || strlen($token) !== 40) {
            $token = Str::random(40);
            $user->mergePref(['calendar_token' => $token]);
        }

        return $token;
    }

    /** Файл .ics для календаря телефона. */
    public function calendarFile(Request $request, string $kind, int $id): \Illuminate\Http\Response
    {
        $entry = $this->calendar->calendarEntry($kind, $id, $this->user($request));
        abort_if($entry === null, 404);

        return response(EventCalendar::ics($entry), 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="gamecon-'.$kind.'-'.$id.'.ics"',
        ]);
    }

    /** Запас нагадування: 10 хв, пів години, година чи доба до початку. */
    public function reminder(Request $request): RedirectResponse
    {
        $data = $request->validate(['lead' => ['required', 'integer', Rule::in(EventCalendar::REMIND_LEADS)]]);
        $user = $this->user($request);
        $user->mergePref(['event_lead' => (int) $data['lead']]);
        $user->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Нагадування збережено.']);

        return back();
    }

    public function releases(Request $request): Response
    {
        abort_unless(app(ModuleManager::class)->enabled('games'), 404);

        return Inertia::render('releases/index', [
            'events' => $this->calendar->releases($this->user($request)),
        ]);
    }

    public function storeServer(Request $request, GtaServer $server): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(array_keys(ServerEvent::TYPES))],
            'description' => ['nullable', 'string', 'max:1000'],
            'starts_at' => ['required', 'date'],
            'family_id' => ['nullable', 'integer'],
            'weekly' => ['sometimes', 'boolean'],
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
            'repeat' => ($data['weekly'] ?? false) ? 'weekly' : null,
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
