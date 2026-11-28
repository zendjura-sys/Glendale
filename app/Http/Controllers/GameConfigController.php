<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameConfig;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Конфіги й приціли гравців до гри: поділитися, скопіювати, позначити «корисно». */
class GameConfigController extends Controller
{
    public function index(Request $request): Response
    {
        app(Plugins::class)->ensure('game_configs');
        $viewer = $request->user();
        $game = $request->query('game') ? Game::query()->where('slug', (string) $request->query('game'))->first() : null;
        $kind = in_array($request->query('kind'), GameConfig::KINDS, true) ? (string) $request->query('kind') : null;
        $tab = in_array($request->query('tab'), ['new', 'mine'], true) ? (string) $request->query('tab') : 'top';

        $configs = GameConfig::query()->with(['user', 'game'])
            ->when($game !== null, fn (Builder $q) => $q->where('game_id', $game?->id))
            ->when($kind !== null, fn (Builder $q) => $q->where('kind', $kind))
            ->when($tab === 'mine', fn (Builder $q) => $q->where('user_id', $viewer->id))
            ->when($tab === 'top', fn (Builder $q) => $q->orderByDesc('likes_count')->orderByDesc('copies_count'))
            ->orderByDesc('id')
            ->paginate(24)->withQueryString();
        $liked = DB::table('game_config_likes')->where('user_id', $viewer->id)->whereIn('game_config_id', $configs->pluck('id'))->pluck('game_config_id')->all();
        $configs->setCollection($configs->getCollection()->map(fn (GameConfig $c) => $this->card($c, in_array($c->id, $liked), $viewer->id)));

        return Inertia::render('configs/index', [
            'configs' => Inertia::scroll(fn () => $configs),
            'game' => $game?->toCard(),
            'kind' => $kind,
            'tab' => $tab,
            'kinds' => GameConfig::KINDS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('game_configs');
        $data = $request->validate([
            'game_id' => ['required', 'integer', Rule::exists('games', 'id')],
            'kind' => ['required', Rule::in(GameConfig::KINDS)],
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'code' => ['required', 'string', 'max:20000'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);
        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($request->user());
        GameConfig::query()->create([
            'user_id' => $request->user()->id,
            'game_id' => (int) $data['game_id'],
            'kind' => $data['kind'],
            'title' => (string) $filter->clean(trim($data['title'])),
            'code' => rtrim($data['code']),
            'description' => $filter->clean(trim((string) ($data['description'] ?? '')) ?: null),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Конфіг опубліковано.']);

        return back();
    }

    /** «Корисно» — увімкнути або зняти. */
    public function like(Request $request, GameConfig $config): JsonResponse
    {
        app(Plugins::class)->ensure('game_configs');
        $user = $request->user();
        $liked = DB::transaction(function () use ($config, $user) {
            $has = DB::table('game_config_likes')->where('game_config_id', $config->id)->where('user_id', $user->id)->exists();
            if ($has) {
                DB::table('game_config_likes')->where('game_config_id', $config->id)->where('user_id', $user->id)->delete();
            } else {
                DB::table('game_config_likes')->insert(['game_config_id' => $config->id, 'user_id' => $user->id, 'created_at' => now()]);
            }
            $config->forceFill(['likes_count' => DB::table('game_config_likes')->where('game_config_id', $config->id)->count()])->save();

            return ! $has;
        });

        return response()->json(['liked' => $liked, 'likes' => $config->likes_count]);
    }

    /** Лічильник копіювань (для сортування «топ»). */
    public function copied(Request $request, GameConfig $config): JsonResponse
    {
        app(Plugins::class)->ensure('game_configs');
        $config->increment('copies_count');

        return response()->json(['copies' => $config->copies_count]);
    }

    public function destroy(Request $request, GameConfig $config): RedirectResponse
    {
        app(Plugins::class)->ensure('game_configs');
        abort_unless($config->user_id === $request->user()->id || $request->user()->isStaff(), 403);
        $config->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Конфіг видалено.']);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function card(GameConfig $config, bool $liked, int $viewerId): array
    {
        return [
            'id' => $config->id,
            'kind' => $config->kind,
            'title' => $config->title,
            'code' => $config->code,
            'description' => $config->description,
            'likes' => $config->likes_count,
            'copies' => $config->copies_count,
            'liked' => $liked,
            'mine' => $config->user_id === $viewerId,
            'author' => $config->user?->toCard(),
            'game' => $config->game?->toCard(),
            'created_at' => $config->created_at->toIso8601String(),
        ];
    }
}
