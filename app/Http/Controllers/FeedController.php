<?php

namespace App\Http\Controllers;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\EventCalendar;
use App\Services\Families\ReportService;
use App\Services\FeedSignals;
use App\Services\FollowAlerts;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use App\Support\I18n\LanguageGuess;
use App\Support\MutedWords;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class FeedController extends Controller
{
    public const PER_PAGE = 10;

    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly CommunityService $communities,
        private readonly FeedSignals $signals,
    ) {}

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user->pref('onboarded') === false) {
            return redirect()->route('start');
        }
        $friendIds = $this->friendships->friendIds($user);
        $communityIds = $this->communities->joinedIds($user);
        $hasSources = $friendIds !== [] || $communityIds !== [];
        $requested = $request->query('tab');
        $tab = match (true) {
            $requested === 'country' => 'country',
            $requested === 'discover' || ! $hasSources => 'discover',
            default => 'friends',
        };

        $query = Post::query()
            ->visibleTo($user, $friendIds)
            ->whereHas('author', fn (Builder $q) => $q->whereNull('banned_at')->whereNull('frozen_at'));

        if ($tab === 'friends') {
            $query->where(fn (Builder $q) => $q
                ->where(fn (Builder $w) => $w->where('wall_type', '!=', 'community')->whereIn('author_id', [...$friendIds, $user->id]))
                ->orWhere(fn (Builder $w) => $w->where('wall_type', 'community')->whereIn('wall_id', $communityIds ?: [0])));
        } elseif ($tab === 'country' && is_string($user->country) && $user->country !== '') {
            $query->where('visibility', Post::VISIBILITY_PUBLIC)
                ->whereHas('author', fn (Builder $q) => $q->where('country', $user->country));
        } elseif ($tab === 'country') {
            $query->whereRaw('1 = 0');
        } else {
            $query->where('visibility', Post::VISIBILITY_PUBLIC)
                ->where('created_at', '>=', now()->subDays(30))
                ->orderByDesc('likes_count');
        }

        $rawLang = $request->query('lang');
        $lang = is_string($rawLang) && in_array($rawLang, LanguageGuess::LANGS, true) ? $rawLang : null;
        if ($lang !== null) {
            $query->where('lang', $lang);
        }

        $this->signals->apply($query, $user, $tab === 'discover');
        MutedWords::hidePosts($query, $user);

        $posts = $query->orderByDesc('id')->cursorPaginate(self::PER_PAGE)->withQueryString();
        $items = $this->presenter->many(new Collection($posts->items()), $user);

        return Inertia::render('feed/index', [
            'tab' => $tab,
            'lang' => $lang,
            'languages' => LanguageGuess::LANGS,
            'country' => $user->country,
            'tomorrow' => Inertia::defer(fn () => $this->tomorrow($user), 'events'),
            'hasFriends' => $hasSources,
            'posts' => Inertia::scroll(fn () => $posts->setCollection(collect($items))),
            'suggestions' => Inertia::defer(fn () => collect($this->friendships->suggestions($user, 5))
                ->map(fn (array $s) => [...$s['user']->toCard(), 'mutual' => $s['mutual']])
                ->all()),
            'onlineFriends' => Inertia::defer(fn () => User::query()
                ->whereIn('id', $friendIds)
                ->where('last_seen_at', '>=', now()->subMinutes(5))
                ->limit(12)
                ->get()
                ->map->toCard()
                ->all()),
            'picks' => $this->picks($user),
            'sameGame' => app(FollowAlerts::class)->sameGame($user),
            'playingNow' => User::query()
                ->whereIn('id', $friendIds === [] ? [0] : $friendIds)
                ->whereNotNull('playing_label')
                ->where('playing_until', '>', now())
                ->orderByDesc('playing_until')
                ->limit(12)
                ->get()
                ->map->toCard()
                ->all(),
            'birthdays' => Inertia::defer(fn () => User::query()
                ->whereIn('id', $friendIds)
                ->whereNotNull('birthday')
                ->whereMonth('birthday', now()->month)
                ->whereDay('birthday', '>=', now()->day)
                ->get()
                ->sortBy(fn (User $u) => $u->birthday?->day)
                ->take(4)
                ->values()
                ->map(fn (User $u) => [...$u->toCard(), 'birthday' => $u->birthday?->toDateString()])
                ->all()),
        ]);
    }

    /**
     * Події клану чи сім’ї людини, що будуть завтра (за київським часом).
     *
     * @return list<array<string, mixed>>
     */
    public function tomorrowFor(User $user): array
    {
        return $this->tomorrow($user);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function tomorrow(User $user): array
    {
        $day = now(ReportService::TIMEZONE)->addDay()->toDateString();
        $items = [];
        foreach (['clan', 'family'] as $kind) {
            foreach (app(EventCalendar::class)->upcoming($user, $kind) as $item) {
                $startsAt = Carbon::parse((string) $item['starts_at'])->setTimezone(ReportService::TIMEZONE);
                if ($startsAt->toDateString() === $day && ($item['status'] ?? null) !== 'declined') {
                    $items[] = $item;
                }
            }
        }
        usort($items, fn (array $a, array $b) => strcmp((string) $a['starts_at'], (string) $b['starts_at']));

        return array_slice($items, 0, 3);
    }

    /**
     * @return list<array{kind: string, title: string, href: string, image: string|null}>
     */
    private function picks(User $user): array
    {
        $rows = Follow::query()->where('user_id', $user->id)->latest('id')->limit(12)->get();
        $games = Game::query()->whereIn('id', $rows->where('kind', Follow::GAME)->pluck('subject_id'))->get()->keyBy('id');
        $servers = GtaServer::query()->whereIn('id', $rows->where('kind', Follow::SERVER)->pluck('subject_id'))->get()->keyBy('id');
        $items = [];
        foreach ($rows as $row) {
            if ($row->kind === Follow::GAME && isset($games[$row->subject_id])) {
                $game = $games[$row->subject_id];
                $items[] = ['kind' => 'game', 'title' => $game->name, 'href' => '/games/'.$game->slug, 'image' => $game->cover];
            }
            if ($row->kind === Follow::SERVER && isset($servers[$row->subject_id])) {
                $server = $servers[$row->subject_id];
                $items[] = ['kind' => 'server', 'title' => $server->name, 'href' => '/servers/'.$server->slug, 'image' => $server->icon];
            }
        }

        return $items;
    }
}
