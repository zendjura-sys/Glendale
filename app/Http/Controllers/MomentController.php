<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Moment;
use App\Models\MomentLike;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Moments\ClipLinks;
use App\Services\Moments\ClipOfWeek;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Моменти: кліпи гравців із YouTube, Twitch і Medal — стрічка, найкраще за тиждень, кліпи друзів. */
class MomentController extends Controller
{
    public function index(Request $request, FriendshipService $friendships): Response
    {
        $filters = $request->validate([
            'tab' => ['nullable', Rule::in(['new', 'week', 'friends'])],
            'game' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        $user = $request->user();
        $tab = $filters['tab'] ?? 'new';
        $page = (int) ($filters['page'] ?? 1);
        $game = ($filters['game'] ?? null) ? Game::query()->where('slug', $filters['game'])->first() : null;

        $query = Moment::query()->with(['user', 'game', 'server'])
            ->when($game, fn (Builder $q, Game $g) => $q->where('game_id', $g->id))
            ->when($tab === 'week', fn (Builder $q) => $q->where('created_at', '>=', now()->subDays(7))->orderByDesc('likes_count'))
            ->when($tab === 'friends', fn (Builder $q) => $q->whereIn('user_id', $friendships->friendIds($user) ?: [0]))
            ->latest('id');
        $items = $query->skip(($page - 1) * 24)->take(25)->get();

        return Inertia::render('moments/index', [
            'clip_of_week' => $page === 1 && $game === null && app(Plugins::class)->on('clip_of_week') ? $this->clipOfWeek($user, $request) : null,
            'moments' => $this->cards($items->take(24), $user, $request),
            'more' => $items->count() > 24,
            'filters' => ['tab' => $tab, 'game' => $game?->slug, 'page' => $page],
            'game' => $game ? ['slug' => $game->slug, 'name' => $game->name] : null,
            'games' => array_values(Game::query()->published()->whereIn('id', Moment::query()->whereNotNull('game_id')->select('game_id'))
                ->orderBy('name')->limit(60)->get(['slug', 'name'])->map(fn (Game $g) => ['slug' => $g->slug, 'name' => $g->name])->all()),
            'options' => [
                'games' => array_values(Game::query()->published()->orderByDesc('popularity')->limit(100)->get(['slug', 'name'])
                    ->sortBy('name')->map(fn (Game $g) => ['slug' => $g->slug, 'name' => $g->name])->values()->all()),
                'servers' => array_values(GtaServer::query()->published()->orderBy('name')->limit(300)->get(['slug', 'name'])
                    ->map(fn (GtaServer $s) => ['slug' => $s->slug, 'name' => $s->name])->all()),
            ],
        ]);
    }

    public function store(Request $request, ClipLinks $links): RedirectResponse
    {
        $data = $request->validate([
            'url' => ['required', 'string', 'max:500'],
            'title' => ['nullable', 'string', 'max:140'],
            'game' => ['nullable', 'string', 'max:120'],
            'server' => ['nullable', 'string', 'max:80'],
        ]);
        $clip = $links->parse($data['url']);
        abort_if($clip === null, 422, 'Підтримуються посилання на кліпи YouTube, Twitch і Medal.');
        $existing = Moment::query()->where('provider', $clip['provider'])->where('external_id', $clip['external_id'])->first();
        if ($existing instanceof Moment) {
            Inertia::flash('toast', ['type' => 'info', 'message' => 'Цей кліп уже є в Моментах.']);

            return redirect('/moments?'.http_build_query(['game' => $existing->game?->slug]));
        }

        $title = trim((string) ($data['title'] ?? '')) ?: ($clip['title'] ?? null) ?: Moment::PROVIDERS[$clip['provider']].' кліп';
        Moment::query()->create([
            'user_id' => $request->user()->id,
            'game_id' => ($data['game'] ?? null) ? Game::query()->where('slug', $data['game'])->value('id') : null,
            'gta_server_id' => ($data['server'] ?? null) ? GtaServer::query()->published()->where('slug', $data['server'])->value('id') : null,
            'provider' => $clip['provider'],
            'external_id' => $clip['external_id'],
            'url' => $clip['url'],
            'embed_url' => $clip['embed'],
            'title' => Str::limit($title, 140, ''),
            'thumbnail' => $clip['thumbnail'],
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Момент додано.']);

        return redirect('/moments');
    }

    public function like(Request $request, Moment $moment): JsonResponse
    {
        $userId = $request->user()->id;
        $liked = DB::transaction(function () use ($moment, $userId) {
            $deleted = MomentLike::query()->where('moment_id', $moment->id)->where('user_id', $userId)->delete();
            if ($deleted === 0) {
                MomentLike::query()->create(['moment_id' => $moment->id, 'user_id' => $userId]);
            }
            $moment->forceFill(['likes_count' => MomentLike::query()->where('moment_id', $moment->id)->count()])->saveQuietly();

            return $deleted === 0;
        });

        return response()->json(['liked' => $liked, 'likes' => $moment->likes_count]);
    }

    public function destroy(Request $request, Moment $moment): RedirectResponse
    {
        abort_unless($moment->user_id === $request->user()->id || $request->user()->isStaff(), 403);
        $moment->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Момент видалено.']);

        return back();
    }

    /**
     * Найкращі моменти гри за місяць (для сторінки гри).
     *
     * @return list<array<string, mixed>>
     */
    public static function forGame(Game $game, User $viewer, Request $request, int $limit = 6): array
    {
        $items = Moment::query()->with(['user', 'game', 'server'])->where('game_id', $game->id)
            ->where('created_at', '>=', now()->subDays(30))->orderByDesc('likes_count')->latest('id')->limit($limit)->get();

        return (new self)->cards($items, $viewer, $request);
    }

    /**
     * «Кліп тижня»: переможець минулого тижня, лідер поточного й архів переможців.
     *
     * @return array<string, mixed>|null
     */
    private function clipOfWeek(User $viewer, Request $request): ?array
    {
        $clips = app(ClipOfWeek::class);
        $history = $clips->history(7);
        $leader = $clips->leader(ClipOfWeek::weekStart());
        $ids = array_values(array_filter([...array_column($history, 'moment_id'), $leader['moment_id'] ?? null]));
        if ($ids === []) {
            return null;
        }
        $cards = collect($this->cards(Moment::query()->with(['user', 'game', 'server'])->whereIn('id', $ids)->get(), $viewer, $request))->keyBy('id');
        $past = array_values(array_filter(array_map(fn (array $h) => $h['moment_id'] !== null && $cards->has($h['moment_id'])
            ? ['week' => $h['week'], 'likes' => $h['likes'], 'moment' => $cards->get($h['moment_id'])]
            : null, $history)));
        // Переможець — лише за минулий тиждень; старіші — в архіві.
        $winner = ($past[0]['week'] ?? null) === ClipOfWeek::weekStart()->subWeek()->toDateString() ? array_shift($past) : null;

        return [
            'winner' => $winner,
            'leader' => $leader && $cards->has($leader['moment_id']) ? ['likes' => $leader['likes'], 'moment' => $cards->get($leader['moment_id'])] : null,
            'history' => $past,
        ];
    }

    /**
     * @param  iterable<Moment>  $items
     * @return list<array<string, mixed>>
     */
    private function cards(iterable $items, User $viewer, Request $request): array
    {
        $items = collect($items);
        $liked = MomentLike::query()->where('user_id', $viewer->id)->whereIn('moment_id', $items->pluck('id'))->pluck('moment_id')->all();
        $host = $request->getHost();

        return array_values($items->map(fn (Moment $m) => [
            'id' => $m->id,
            'title' => $m->title,
            'provider' => $m->provider,
            'provider_label' => Moment::PROVIDERS[$m->provider] ?? $m->provider,
            'url' => $m->url,
            'player' => ClipLinks::player($m->embed_url, $host),
            'thumbnail' => $m->thumbnail,
            'likes' => $m->likes_count,
            'liked' => in_array($m->id, $liked, true),
            'can_delete' => $m->user_id === $viewer->id || $viewer->isStaff(),
            'user' => $m->user->toCard(),
            'game' => $m->game ? ['slug' => $m->game->slug, 'name' => $m->game->name] : null,
            'server' => $m->server ? ['slug' => $m->server->slug, 'name' => $m->server->name] : null,
            'created_at' => $m->created_at->toIso8601String(),
        ])->all());
    }
}
