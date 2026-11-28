<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\TierList;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Тір-листи: рівні S…D з пунктами, поширюються посиланням. */
class TierListController extends Controller
{
    public const COLORS = ['rose', 'amber', 'lime', 'sky', 'violet', 'slate'];

    public function index(Request $request): Response
    {
        app(Plugins::class)->ensure('tier_lists');
        $tab = in_array($request->query('tab'), ['new', 'mine'], true) ? (string) $request->query('tab') : 'top';
        $game = $request->query('game') ? Game::query()->where('slug', (string) $request->query('game'))->first() : null;

        $lists = TierList::query()->with(['user', 'game'])
            ->when($tab === 'mine', fn (Builder $q) => $q->where('user_id', $request->user()->id), fn (Builder $q) => $q->where('is_public', true))
            ->when($game !== null, fn (Builder $q) => $q->where('game_id', $game?->id))
            ->when($tab === 'top', fn (Builder $q) => $q->orderByDesc('views_count'))
            ->orderByDesc('id')
            ->paginate(24)->withQueryString();
        $lists->setCollection($lists->getCollection()->map(fn (TierList $list) => $this->card($list)));

        return Inertia::render('tierlists/index', [
            'lists' => Inertia::scroll(fn () => $lists),
            'tab' => $tab,
            'game' => $game ? ['slug' => $game->slug, 'name' => $game->name] : null,
        ]);
    }

    public function create(Request $request): Response
    {
        app(Plugins::class)->ensure('tier_lists');
        $game = $request->query('game') ? Game::query()->where('slug', (string) $request->query('game'))->first() : null;

        return Inertia::render('tierlists/edit', [
            'list' => null,
            'game' => $game ? ['id' => $game->id, 'slug' => $game->slug, 'name' => $game->name] : null,
            'colors' => self::COLORS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('tier_lists');
        $list = TierList::query()->create(['user_id' => $request->user()->id, ...$this->validated($request)]);

        return to_route('tierlists.show', $list);
    }

    public function show(Request $request, TierList $tierList): Response
    {
        app(Plugins::class)->ensure('tier_lists');
        $own = $request->user()?->id === $tierList->user_id;
        abort_unless($tierList->is_public || $own, 404);
        if (! $own) {
            $tierList->increment('views_count');
        }

        return Inertia::render('tierlists/show', ['list' => [...$this->card($tierList->load(['user', 'game'])), 'tiers' => $tierList->tiers], 'own' => $own]);
    }

    public function edit(Request $request, TierList $tierList): Response
    {
        abort_unless($request->user()->id === $tierList->user_id, 403);

        return Inertia::render('tierlists/edit', [
            'list' => ['id' => $tierList->id, 'title' => $tierList->title, 'tiers' => $tierList->tiers, 'is_public' => $tierList->is_public],
            'game' => $tierList->game ? ['id' => $tierList->game->id, 'slug' => $tierList->game->slug, 'name' => $tierList->game->name] : null,
            'colors' => self::COLORS,
        ]);
    }

    public function update(Request $request, TierList $tierList): RedirectResponse
    {
        abort_unless($request->user()->id === $tierList->user_id, 403);
        $tierList->update($this->validated($request));

        return to_route('tierlists.show', $tierList);
    }

    public function destroy(Request $request, TierList $tierList): RedirectResponse
    {
        abort_unless($request->user()->id === $tierList->user_id || $request->user()->isStaff(), 403);
        $tierList->delete();

        return to_route('tierlists.index', ['tab' => 'mine']);
    }

    /**
     * @return array{title: string, game_id: int|null, is_public: bool, tiers: list<array{label: string, color: string, items: list<string>}>}
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:100'],
            'game_id' => ['nullable', 'integer', 'exists:games,id'],
            'is_public' => ['required', 'boolean'],
            'tiers' => ['required', 'array', 'min:2', 'max:8'],
            'tiers.*.label' => ['required', 'string', 'max:12'],
            'tiers.*.color' => ['required', 'in:'.implode(',', self::COLORS)],
            'tiers.*.items' => ['present', 'array', 'max:30'],
            'tiers.*.items.*' => ['nullable', 'string', 'max:40'],
        ]);
        $tiers = [];
        foreach ($data['tiers'] as $tier) {
            $tiers[] = [
                'label' => trim((string) $tier['label']),
                'color' => (string) $tier['color'],
                'items' => array_values(array_filter(array_map(fn ($item) => trim((string) $item), (array) $tier['items']), fn (string $item) => $item !== '')),
            ];
        }

        return ['title' => trim($data['title']), 'game_id' => $data['game_id'] ?? null, 'is_public' => (bool) $data['is_public'], 'tiers' => $tiers];
    }

    /**
     * @return array<string, mixed>
     */
    private function card(TierList $list): array
    {
        return [
            'id' => $list->id,
            'title' => $list->title,
            'author' => $list->user?->toCard(),
            'game' => $list->game ? ['slug' => $list->game->slug, 'name' => $list->game->name, 'cover' => $list->game->cover] : null,
            'is_public' => $list->is_public,
            'views' => $list->views_count,
            'preview' => array_map(fn (array $tier) => ['label' => $tier['label'], 'color' => $tier['color'], 'count' => count($tier['items'])], $list->tiers),
            'updated_at' => $list->updated_at->toIso8601String(),
        ];
    }
}
