<?php

namespace App\Services\Feed;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Friendship;
use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\GameReview;
use App\Models\Movie;
use App\Models\MovieList;
use App\Models\MovieReview;
use App\Models\TierList;
use App\Models\User;
use App\Services\FriendshipService;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Стрічка активності друзів: що вони робили за тиждень, крім записів — ігри в беклозі, відгуки,
 * добірки кіно, тір-листи, нові друзі, вступ у відкриті спільноти. Окремої таблиці немає: збираємо
 * з наявних даних і показуємо лише те, що й так видно в їхніх профілях.
 */
class FriendActivity
{
    public const DAYS = 7;

    public const LIMIT = 40;

    public function __construct(private readonly FriendshipService $friendships) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function for(User $viewer, ?string $before = null): array
    {
        $friendIds = $this->friendships->friendIds($viewer);
        if ($friendIds === []) {
            return [];
        }
        $since = now()->subDays(self::DAYS);
        $until = $before !== null && strtotime($before) !== false ? now()->setTimestamp((int) strtotime($before)) : now();
        $modules = app(ModuleManager::class);
        $plugins = app(Plugins::class);
        $people = User::query()->whereIn('id', $friendIds)->whereNull('banned_at')->get()->keyBy('id');
        $ids = $people->keys()->all();
        $range = fn ($q, string $column = 'created_at') => $q->whereIn('user_id', $ids)->where($column, '>=', $since)->where($column, '<', $until)->orderByDesc($column)->limit(self::LIMIT);

        /** @var Collection<int, array<string, mixed>> $items */
        $items = collect();

        if ($modules->enabled('games')) {
            $range(GameBacklog::query()->with('game'), 'updated_at')->get()
                ->filter(fn (GameBacklog $b) => $b->game !== null)
                ->each(fn (GameBacklog $b) => $items->push($this->item('backlog.'.$b->status, $b->user_id, $b->updated_at, [
                    'game' => $this->game($b->game),
                ])));
            $range(GameReview::query()->with('game'))->get()
                ->each(fn (GameReview $r) => $items->push($this->item('game_review', $r->user_id, $r->created_at, [
                    'game' => $r->game ? $this->game($r->game) : null,
                    'score' => $r->score,
                    'excerpt' => Str::limit($r->body, 140),
                ])));
            $range(TierList::query()->where('is_public', true))->get()
                ->each(fn (TierList $t) => $items->push($this->item('tier_list', $t->user_id, $t->created_at, [
                    'title' => $t->title,
                    'href' => '/tierlists/'.$t->id,
                ])));
        }

        if ($modules->enabled('cinema')) {
            $range(MovieReview::query()->with('movie'))->get()
                ->filter(fn (MovieReview $r) => $r->movie?->is_published)
                ->each(fn (MovieReview $r) => $items->push($this->item('movie_review', $r->user_id, $r->created_at, [
                    'movie' => $this->movie($r->movie),
                    'score' => $r->score,
                    'excerpt' => $r->spoiler ? null : Str::limit($r->body, 140),
                ])));
            if ($plugins->on('movie_lists')) {
                $range(MovieList::query()->where('is_public', true)->where('items_count', '>', 0))->get()
                    ->each(fn (MovieList $l) => $items->push($this->item('movie_list', $l->user_id, $l->created_at, [
                        'title' => $l->title,
                        'count' => $l->items_count,
                        'href' => '/cinema/lists/'.$l->id,
                    ])));
            }
        }

        // Нові друзі друзів (лише якщо другу сторону не заблоковано й вона не прихована).
        Friendship::query()->where('status', Friendship::ACCEPTED)
            ->where('accepted_at', '>=', $since)->where('accepted_at', '<', $until)
            ->where(fn ($q) => $q->whereIn('requester_id', $ids)->orWhereIn('addressee_id', $ids))
            ->orderByDesc('accepted_at')->limit(self::LIMIT)->get()
            ->each(function (Friendship $f) use ($items, $people, $viewer) {
                $actor = $people->has($f->requester_id) ? $f->requester_id : $f->addressee_id;
                $other = $actor === $f->requester_id ? $f->addressee_id : $f->requester_id;
                if ($other === $viewer->id || $f->accepted_at === null) {
                    return;
                }
                $otherUser = $people->get($other) ?? User::query()->whereKey($other)->whereNull('banned_at')->first();
                if ($otherUser) {
                    $items->push($this->item('friend', $actor, $f->accepted_at, ['other' => $otherUser->toCard()]));
                }
            });

        if ($modules->enabled('communities')) {
            CommunityMember::query()->with('community')->whereIn('user_id', $ids)->where('status', 'active')
                ->where('created_at', '>=', $since)->where('created_at', '<', $until)
                ->orderByDesc('created_at')->limit(self::LIMIT)->get()
                ->filter(fn (CommunityMember $m) => $m->community && $m->community->privacy === Community::PRIVACY_OPEN && $m->community->is_listed && $m->created_at)
                ->each(fn (CommunityMember $m) => $items->push($this->item('community', $m->user_id, $m->created_at, [
                    'community' => ['name' => $m->community->name, 'href' => '/c/'.$m->community->slug, 'avatar' => $m->community->avatar_url],
                ])));
        }

        return $items->sortByDesc('at')->take(self::LIMIT)->values()
            ->map(fn (array $i) => [...$i, 'user' => $people->get($i['user_id'])?->toCard()])
            ->filter(fn (array $i) => $i['user'] !== null)
            ->map(fn (array $i) => array_diff_key($i, ['user_id' => true]))
            ->values()->all();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function item(string $kind, int $userId, \DateTimeInterface $at, array $data): array
    {
        return ['id' => $kind.':'.$userId.':'.$at->getTimestamp().':'.md5(json_encode($data) ?: ''), 'kind' => $kind, 'user_id' => $userId, 'at' => $at->format(DATE_ATOM), ...$data];
    }

    /** @return array{title: string, href: string, cover: string|null} */
    private function game(Game $game): array
    {
        return ['title' => $game->name ?? '', 'href' => '/games/'.$game->slug, 'cover' => $game->toCard()['cover'] ?? null];
    }

    /** @return array{title: string, href: string, cover: string|null} */
    private function movie(Movie $movie): array
    {
        return ['title' => $movie->title, 'href' => '/cinema/'.$movie->slug, 'cover' => $movie->poster];
    }
}
