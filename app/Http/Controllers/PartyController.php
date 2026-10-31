<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PartyPost;
use App\Models\PartyTimeSlot;
use App\Services\Party\PartyBoard;
use App\Services\Party\PartyTimeVote;
use App\Services\Party\Teammates;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PartyController extends Controller
{
    public function __construct(private readonly PartyBoard $board) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'game' => ['nullable', 'string', 'max:120'],
            'server' => ['nullable', 'string', 'max:80'],
            'platform' => ['nullable', Rule::in(array_keys(PartyPost::PLATFORMS))],
            'mic' => ['nullable', 'boolean'],
            'language' => ['nullable', Rule::in(array_keys(PartyPost::LANGUAGES))],
            'style' => ['nullable', Rule::in(array_keys(PartyPost::STYLES))],
        ]);
        $user = $request->user();
        $lfg = app(Plugins::class)->on('lfg_filters');
        $age = $user->birthday?->age;
        $parties = PartyPost::query()->open()
            ->with(['user', 'game', 'server', 'members.user'])
            ->when($filters['game'] ?? null, fn (Builder $q, string $slug) => $q->whereHas('game', fn (Builder $g) => $g->where('slug', $slug)))
            ->when($filters['server'] ?? null, fn (Builder $q, string $slug) => $q->whereHas('server', fn (Builder $s) => $s->where('slug', $slug)))
            ->when($filters['platform'] ?? null, fn (Builder $q, string $platform) => $q->where('platform', $platform))
            ->when($lfg && ($filters['mic'] ?? false), fn (Builder $q) => $q->where('mic_required', true))
            ->when($lfg ? ($filters['language'] ?? null) : null, fn (Builder $q, string $lang) => $q->where('language', $lang))
            ->when($lfg ? ($filters['style'] ?? null) : null, fn (Builder $q, string $style) => $q->where('style', $style))
            // Паті з віковим обмеженням не показуємо тим, хто молодший (якщо вік відомий).
            ->when($lfg && $age !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w->whereNull('age_min')->orWhere('age_min', '<=', $age)))
            ->orderByRaw('case when bumped_until > ? then 0 else 1 end', [now()])
            ->orderByRaw('coalesce(starts_at, created_at)')
            ->limit(60)
            ->get();

        return Inertia::render('party/index', [
            'parties' => array_values($parties->map(fn (PartyPost $party) => $this->board->card($party, $user))->all()),
            'filters' => [
                'game' => $filters['game'] ?? null,
                'server' => $filters['server'] ?? null,
                'platform' => $filters['platform'] ?? null,
                'mic' => (bool) ($filters['mic'] ?? false),
                'language' => $filters['language'] ?? null,
                'style' => $filters['style'] ?? null,
            ],
            'options' => [
                'platforms' => PartyPost::PLATFORMS,
                'languages' => PartyPost::LANGUAGES,
                'styles' => PartyPost::STYLES,
                'ages' => PartyPost::AGES,
                'games' => array_values(Game::query()->where('is_published', true)->orderByDesc('popularity')->limit(80)->get(['slug', 'name'])
                    ->map(fn (Game $game) => ['slug' => $game->slug, 'name' => $game->name])->all()),
                'servers' => array_values(GtaServer::query()->published()->orderBy('name')->limit(300)->get(['slug', 'name'])
                    ->map(fn (GtaServer $server) => ['slug' => $server->slug, 'name' => $server->name])->all()),
            ],
        ]);
    }

    public function show(Request $request, PartyPost $party): Response
    {
        $user = $request->user();

        return Inertia::render('party/show', [
            'party' => $this->board->card($party, $user),
            // Автору відкритого паті — хто з підбору тиммейтів підходить (спершу ті, хто шукає зараз).
            'suggestions' => $party->user_id === $user->id && $party->isOpen() && $party->members()->count() + 1 < $party->slots ? app(Teammates::class)->forParty($party, $user) : [],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
            'game' => ['nullable', 'string', 'max:120'],
            'server' => ['nullable', 'string', 'max:80'],
            'platform' => ['nullable', Rule::in(array_keys(PartyPost::PLATFORMS))],
            'roles' => ['nullable', 'array', 'max:5'],
            'roles.*' => ['string', 'max:40'],
            'slots' => ['required', 'integer', 'min:2', 'max:20'],
            'starts_at' => ['nullable', 'date', 'after:-10 minutes', 'before:+7 days'],
            // Голосування за час: 2–4 варіанти замість одного часу.
            'time_options' => ['nullable', 'array', 'min:'.PartyTimeVote::MIN, 'max:'.PartyTimeVote::MAX],
            'time_options.*' => ['date', 'after:now', 'before:+7 days', 'distinct'],
            'mic' => ['nullable', 'boolean'],
            'language' => ['nullable', Rule::in(array_keys(PartyPost::LANGUAGES))],
            'age_min' => ['nullable', Rule::in(PartyPost::AGES)],
            'style' => ['nullable', Rule::in(array_keys(PartyPost::STYLES))],
        ]);
        /** @var list<Carbon> $options */
        $options = [];
        if (app(Plugins::class)->on('party_time_vote')) {
            foreach ((array) ($data['time_options'] ?? []) as $time) {
                $options[] = Carbon::parse((string) $time);
            }
            usort($options, fn (Carbon $a, Carbon $b) => $a <=> $b);
        }
        $game = ($data['game'] ?? null) ? Game::query()->where('slug', $data['game'])->first() : null;
        $server = ($data['server'] ?? null) ? GtaServer::query()->published()->where('slug', $data['server'])->first() : null;
        $roles = array_values(array_unique(array_filter(array_map(fn ($role) => trim((string) $role), $data['roles'] ?? []))));

        $party = $this->board->create($request->user(), [
            'title' => trim($data['title']),
            'note' => trim((string) ($data['note'] ?? '')) ?: null,
            'platform' => $data['platform'] ?? null,
            'roles' => $roles,
            'slots' => (int) $data['slots'],
            'starts_at' => $options === [] && ($data['starts_at'] ?? null) ? Carbon::parse($data['starts_at']) : null,
            'game_id' => $game?->id,
            'gta_server_id' => $server?->id,
            'mic_required' => (bool) ($data['mic'] ?? false),
            'language' => $data['language'] ?? null,
            'age_min' => isset($data['age_min']) ? (int) $data['age_min'] : null,
            'style' => $data['style'] ?? null,
        ], $options === [] ? null : $options[count($options) - 1]);
        if ($options !== []) {
            app(PartyTimeVote::class)->open($party, $options);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оголошення опубліковано.']);

        return redirect('/party/'.$party->id);
    }

    /** «Мені підходить»: свій вибір варіантів часу (можна кілька або жодного). */
    public function voteTime(Request $request, PartyPost $party, PartyTimeVote $votes): RedirectResponse
    {
        app(Plugins::class)->ensure('party_time_vote');
        $data = $request->validate(['slots' => ['present', 'array', 'max:'.PartyTimeVote::MAX], 'slots.*' => ['integer']]);
        $votes->vote($party, $request->user(), $data['slots']);

        return back();
    }

    /** Автор закріплює час: він стає часом старту, учасникам — сповіщення. */
    public function pickTime(Request $request, PartyPost $party, PartyTimeSlot $slot, PartyTimeVote $votes): RedirectResponse
    {
        app(Plugins::class)->ensure('party_time_vote');
        $votes->pick($party, $request->user(), $slot);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Час закріплено. Учасники отримали сповіщення.']);

        return back();
    }

    public function join(Request $request, PartyPost $party): RedirectResponse
    {
        $data = $request->validate(['role' => ['nullable', 'string', 'max:40']]);
        $this->board->join($party, $request->user(), $data['role'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ви в паті. Заходьте в голосову кімнату.']);

        return redirect('/party/'.$party->id);
    }

    public function leave(Request $request, PartyPost $party): RedirectResponse
    {
        $this->board->leave($party, $request->user());

        return back();
    }

    public function bump(Request $request, PartyPost $party): RedirectResponse
    {
        $this->board->bump($party, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оголошення піднято нагору на годину.']);

        return back();
    }

    public function close(Request $request, PartyPost $party): RedirectResponse
    {
        abort_unless($party->user_id === $request->user()->id || $request->user()->isStaff(), 403);
        $this->board->close($party);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оголошення закрито.']);

        return redirect('/party');
    }
}
