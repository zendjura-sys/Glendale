<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PartyPost;
use App\Services\Party\PartyBoard;
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
        ]);
        $user = $request->user();
        $parties = PartyPost::query()->open()
            ->with(['user', 'game', 'server', 'members.user'])
            ->when($filters['game'] ?? null, fn (Builder $q, string $slug) => $q->whereHas('game', fn (Builder $g) => $g->where('slug', $slug)))
            ->when($filters['server'] ?? null, fn (Builder $q, string $slug) => $q->whereHas('server', fn (Builder $s) => $s->where('slug', $slug)))
            ->when($filters['platform'] ?? null, fn (Builder $q, string $platform) => $q->where('platform', $platform))
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
            ],
            'options' => [
                'platforms' => PartyPost::PLATFORMS,
                'games' => array_values(Game::query()->where('is_published', true)->orderByDesc('popularity')->limit(80)->get(['slug', 'name'])
                    ->map(fn (Game $game) => ['slug' => $game->slug, 'name' => $game->name])->all()),
                'servers' => array_values(GtaServer::query()->published()->orderBy('name')->limit(300)->get(['slug', 'name'])
                    ->map(fn (GtaServer $server) => ['slug' => $server->slug, 'name' => $server->name])->all()),
            ],
        ]);
    }

    public function show(Request $request, PartyPost $party): Response
    {
        return Inertia::render('party/show', ['party' => $this->board->card($party, $request->user())]);
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
        ]);
        $game = ($data['game'] ?? null) ? Game::query()->where('slug', $data['game'])->first() : null;
        $server = ($data['server'] ?? null) ? GtaServer::query()->published()->where('slug', $data['server'])->first() : null;
        $roles = array_values(array_unique(array_filter(array_map(fn ($role) => trim((string) $role), $data['roles'] ?? []))));

        $party = $this->board->create($request->user(), [
            'title' => trim($data['title']),
            'note' => trim((string) ($data['note'] ?? '')) ?: null,
            'platform' => $data['platform'] ?? null,
            'roles' => $roles,
            'slots' => (int) $data['slots'],
            'starts_at' => ($data['starts_at'] ?? null) ? Carbon::parse($data['starts_at']) : null,
            'game_id' => $game?->id,
            'gta_server_id' => $server?->id,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оголошення опубліковано.']);

        return redirect('/party/'.$party->id);
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
