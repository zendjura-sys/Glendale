<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameGiveaway;
use App\Models\GameWishlist;
use App\Models\User;
use App\Services\Games\CheapShark;
use App\Services\Games\Giveaways;
use App\Services\Games\Hardware;
use App\Services\Games\SteamStore;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ігри без переплат: роздачі (Epic, Steam, GOG), список бажаного зі сповіщенням про знижку,
 * ціни в магазинах і «чи потягне мій ПК».
 */
class GameDealsController extends Controller
{
    public function __construct(private readonly Plugins $plugins) {}

    /** Сторінка «Безкоштовно й зі знижкою»: роздачі й мій список бажаного. */
    public function index(Request $request, Giveaways $giveaways): Response|JsonResponse
    {
        abort_unless($this->plugins->on('game_giveaways') || $this->plugins->on('game_deals'), 404);
        $user = $this->user($request);
        $props = [
            'giveaways' => $this->plugins->on('game_giveaways') ? $giveaways->active()->map(fn (GameGiveaway $g) => $g->toCard())->values() : [],
            'subscribed' => $user->pref(Giveaways::PREF) === true,
            'wishlist' => $this->plugins->on('game_deals')
                ? GameWishlist::query()->with('game')->where('user_id', $user->id)->latest('id')->get()
                    ->map(fn (GameWishlist $w) => [
                        'game' => $w->game->toCard(),
                        'target_price' => $w->target_price !== null ? (float) $w->target_price : null,
                        // Лише з кешу: сторінка не чекає на магазини, ціни підтягує фонова перевірка.
                        'best' => ($appId = $w->game->steamAppId()) !== null ? (Cache::get('cheapshark.steam.'.$appId)['deals'][0] ?? null) : null,
                    ])->values()
                : [],
        ];
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json($props);
        }

        return Inertia::render('games/deals', $props);
    }

    /** Підписка на сповіщення про нові роздачі. */
    public function subscribe(Request $request): RedirectResponse
    {
        $this->plugins->ensure('game_giveaways');
        $data = $request->validate(['on' => ['required', 'boolean']]);
        $this->user($request)->mergePref([Giveaways::PREF => (bool) $data['on']]);

        return back();
    }

    /** Ціни на гру в магазинах + чи вона в моєму бажаному (JSON для сторінки гри). */
    public function prices(Request $request, Game $game, SteamStore $steam, CheapShark $cheapShark): JsonResponse
    {
        $this->plugins->ensure('game_deals');
        $appId = $game->steamAppId() !== null ? (int) $game->steamAppId() : null;
        $app = $appId !== null ? $steam->app($appId) : null;
        $deals = $appId !== null ? $cheapShark->forSteam($appId) : null;
        $wish = GameWishlist::query()->where('user_id', $this->user($request)->id)->where('game_id', $game->id)->first();

        return response()->json([
            'free' => $app['free'] ?? false,
            'steam' => $app['price'] ?? null,
            'steam_url' => $appId !== null ? 'https://store.steampowered.com/app/'.$appId : null,
            'deals' => $deals['deals'] ?? [],
            'lowest_ever' => $deals['lowest_ever'] ?? null,
            'giveaway' => GameGiveaway::query()->where('game_id', $game->id)->where('active', true)->first()?->toCard(),
            'wished' => $wish !== null,
            'target_price' => $wish?->target_price !== null ? (float) $wish->target_price : null,
        ]);
    }

    /** Додати гру в бажане (з бажаною ціною) або прибрати. */
    public function wish(Request $request, Game $game): JsonResponse
    {
        $this->plugins->ensure('game_deals');
        $data = $request->validate([
            'on' => ['required', 'boolean'],
            'target_price' => ['nullable', 'numeric', 'min:0', 'max:999'],
        ]);
        $user = $this->user($request);
        if (! $data['on']) {
            GameWishlist::query()->where('user_id', $user->id)->where('game_id', $game->id)->delete();

            return response()->json(['wished' => false, 'target_price' => null]);
        }
        abort_if(GameWishlist::query()->where('user_id', $user->id)->count() >= 200
            && ! GameWishlist::query()->where('user_id', $user->id)->where('game_id', $game->id)->exists(), 422, 'У списку бажаного вже 200 ігор.');
        $target = isset($data['target_price']) ? round((float) $data['target_price'], 2) : null;
        GameWishlist::query()->updateOrCreate(
            ['user_id' => $user->id, 'game_id' => $game->id],
            ['target_price' => $target, 'notified_price' => null],
        );

        return response()->json(['wished' => true, 'target_price' => $target]);
    }

    /** «Чи потягне»: вимоги Steam і порівняння з моєю збіркою. */
    public function pcCheck(Request $request, Game $game, SteamStore $steam): JsonResponse
    {
        $this->plugins->ensure('pc_check');
        $appId = $game->steamAppId() !== null ? (int) $game->steamAppId() : null;
        $app = $appId !== null ? $steam->app($appId) : null;
        $req = $app['requirements'] ?? ['minimum' => [], 'recommended' => []];
        $pc = $this->pc($this->user($request));
        $configured = array_filter($pc, fn ($v) => $v !== null && $v !== '') !== [];
        $minimum = $configured ? Hardware::compare($pc, $req['minimum']) : null;
        $recommended = $configured ? Hardware::compare($pc, $req['recommended']) : null;

        return response()->json([
            'requirements' => $req,
            'pc' => $pc,
            'configured' => $configured,
            'minimum' => $minimum,
            'recommended' => $recommended,
            'summary' => match (true) {
                ! $configured || ($req['minimum'] === [] && $req['recommended'] === []) => null,
                ($recommended['verdict'] ?? null) === 'ok' => 'recommended',
                ($minimum['verdict'] ?? null) === 'ok' => 'minimum',
                ($minimum['verdict'] ?? null) === 'fail' => 'below',
                default => 'unknown',
            },
        ]);
    }

    /** Моя збірка ПК (одна на акаунт): процесор, відеокарта, пам'ять. */
    public function pcShow(Request $request): JsonResponse
    {
        $this->plugins->ensure('pc_check');
        $pc = $this->pc($this->user($request));

        return response()->json([...$this->recognized($pc), 'gpus' => Hardware::gpuNames()]);
    }

    public function pcSave(Request $request): JsonResponse
    {
        $this->plugins->ensure('pc_check');
        $data = $request->validate([
            'cpu' => ['nullable', 'string', 'max:80'],
            'gpu' => ['nullable', 'string', 'max:80'],
            'ram' => ['nullable', 'integer', 'min:1', 'max:512'],
        ]);
        $pc = ['cpu' => trim((string) ($data['cpu'] ?? '')) ?: null, 'gpu' => trim((string) ($data['gpu'] ?? '')) ?: null, 'ram' => $data['ram'] ?? null];
        $this->user($request)->mergePref(['pc' => $pc]);

        return response()->json($this->recognized($pc));
    }

    /**
     * @param  array{cpu: string|null, gpu: string|null, ram: int|null}  $pc
     * @return array<string, mixed>
     */
    private function recognized(array $pc): array
    {
        return [
            'pc' => $pc,
            'cpu_known' => $pc['cpu'] !== null && Hardware::cpu($pc['cpu']) !== null,
            'gpu_known' => $pc['gpu'] !== null && Hardware::gpu($pc['gpu']) !== null,
        ];
    }

    /**
     * @return array{cpu: string|null, gpu: string|null, ram: int|null}
     */
    private function pc(User $user): array
    {
        $pc = $user->pref('pc');
        $pc = is_array($pc) ? $pc : [];

        return [
            'cpu' => is_string($pc['cpu'] ?? null) ? $pc['cpu'] : null,
            'gpu' => is_string($pc['gpu'] ?? null) ? $pc['gpu'] : null,
            'ram' => is_numeric($pc['ram'] ?? null) ? (int) $pc['ram'] : null,
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
