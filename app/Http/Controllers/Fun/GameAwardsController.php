<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\Games\GameAwards;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** «Гра року» спільноти: номінації, голосування в грудні, підсумки й архів. */
class GameAwardsController extends Controller
{
    public function __construct(private readonly GameAwards $awards) {}

    public function index(Request $request, ?int $year = null): Response
    {
        app(Plugins::class)->ensure('game_awards');
        $current = $this->awards->currentYear();
        $year ??= $current;
        abort_if($year > $current || $year < 2024, 404);
        $phase = $this->awards->phase($year);
        $results = $phase === 'results' ? $this->awards->results($year) : null;
        $mine = $request->user() ? $this->awards->mine($request->user(), $year) : [];

        return Inertia::render('games/awards', [
            'year' => $year,
            'phase' => $phase,
            // Дати без часу — щоб у будь-якому поясі було «1 грудня» і «31 грудня».
            'opens_on' => $this->awards->opensAt($year)->toDateString(),
            'closes_on' => $this->awards->closesAt($year)->subDay()->toDateString(),
            'voters' => $this->awards->voters($year),
            'categories' => collect(GameAwards::CATEGORIES)->map(fn (array $c, string $key) => [
                'key' => $key,
                'label' => $c['label'],
                'hint' => $c['hint'],
                'mine' => $mine[$key] ?? null,
                'results' => $results[$key] ?? null,
            ])->values(),
            'archive' => $this->awards->archive(),
            'next_year' => $phase === 'results' && $year < $this->awards->now()->year ? $this->awards->now()->year : null,
            'next_opens_on' => $this->awards->opensAt($this->awards->now()->year)->toDateString(),
        ]);
    }

    public function candidates(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('game_awards');
        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(GameAwards::CATEGORIES))],
            'q' => ['nullable', 'string', 'max:80'],
        ]);

        return response()->json(['games' => $this->awards->candidates($this->awards->currentYear(), $data['category'], trim((string) ($data['q'] ?? '')))]);
    }

    public function vote(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('game_awards');
        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(GameAwards::CATEGORIES))],
            'game' => ['nullable', 'string', 'max:120'],
        ]);
        $user = $request->user();
        $year = $this->awards->currentYear();
        if (($data['game'] ?? null) === null) {
            $this->awards->unvote($user, $year, $data['category']);

            return response()->json(['ok' => true, 'mine' => null, 'message' => 'Голос прибрано.']);
        }
        $game = Game::query()->where('slug', $data['game'])->firstOrFail();
        $this->awards->vote($user, $year, $data['category'], $game);

        return response()->json(['ok' => true, 'mine' => $game->toCard(), 'message' => 'Голос зараховано.']);
    }
}
