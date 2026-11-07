<?php

namespace App\Services\Wrapped;

use App\Models\Conversation;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\PlayedPlace;
use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Support\NetworkModes;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * «Підсумки року»: що людина робила в GameCon за рік — пости й реакції, друзі й найближчий друг,
 * музика, кіно, ігри й сервери, досвід. Показуються з 1 грудня до 31 січня (у січні — за минулий рік),
 * адміністратор бачить свої підсумки будь-коли. Рахується раз на кілька годин і кешується.
 */
class YearInReview
{
    /** Скільки годин тримаємо пораховані підсумки. */
    private const CACHE_HOURS = 6;

    /** Рік, за який зараз показуємо підсумки, або null — не сезон. */
    public function season(?CarbonImmutable $now = null): ?int
    {
        $now ??= CarbonImmutable::now();

        return match ($now->month) {
            12 => $now->year,
            1 => $now->year - 1,
            default => null,
        };
    }

    /** Рік для людини: у сезон — для всіх, поза ним — лише адміністраторові (попередній перегляд). */
    public function yearFor(User $user): ?int
    {
        return $this->season() ?? ($user->isAdmin() ? CarbonImmutable::now()->year : null);
    }

    /**
     * @return array<string, mixed>
     */
    public function build(User $user, int $year): array
    {
        $data = Cache::remember("wrapped:v2:{$year}:{$user->id}", now()->addHours(self::CACHE_HOURS), fn () => $this->compute($user, $year));
        // Розділів, яких немає в режимі людини, у підсумках теж немає (нулі — слайд не показується).
        $modules = app(NetworkModes::class)->modulesFor($user);
        $sections = ['music' => ['music'], 'cinema' => ['cinema'], 'games' => ['games', 'servers', 'moments']];
        foreach ($sections as $section => $need) {
            if (array_intersect($need, $modules) === [] && is_array($data[$section] ?? null)) {
                $data[$section] = self::blank($data[$section]);
                $data['persona'] = $this->persona($data['posts'], $data['social'], $data['music'], $data['cinema'], $data['games']);
            }
        }

        return $data;
    }

    /**
     * @param  array<mixed>  $section
     * @return array<mixed>
     */
    private static function blank(array $section): array
    {
        return array_map(fn ($value) => match (true) {
            is_int($value), is_float($value) => 0,
            is_array($value) => array_is_list($value) ? [] : self::blank($value),
            default => null,
        }, $section);
    }

    /**
     * @return array<string, mixed>
     */
    private function compute(User $user, int $year): array
    {
        $from = CarbonImmutable::create($year, 1, 1)->startOfDay();
        $to = $from->addYear();
        $range = [$from, $to];

        $posts = $this->posts($user, $range);
        $social = $this->social($user, $range);
        $music = $this->music($user, $range);
        $cinema = $this->cinema($user, $range);
        $games = $this->games($user, $range);
        $progress = $this->progress($user, $range);

        return [
            'year' => $year,
            'user' => $user->toCard(),
            'joined_this_year' => $user->created_at !== null && $user->created_at->year === $year,
            'active_days' => $this->activeDays($user, $range),
            'posts' => $posts,
            'social' => $social,
            'music' => $music,
            'cinema' => $cinema,
            'games' => $games,
            'progress' => $progress,
            'persona' => $this->persona($posts, $social, $music, $cinema, $games),
        ];
    }

    /**
     * Дні, коли людина щось робила: писала, реагувала, слухала, грала чи виконувала завдання.
     *
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     */
    private function activeDays(User $user, array $range): int
    {
        $days = [];
        $collect = function ($query, string $column) use (&$days, $range) {
            $query->where($column, '>=', $range[0])->where($column, '<', $range[1])
                ->selectRaw("DATE({$column}) as d")->distinct()->pluck('d')
                ->each(function ($d) use (&$days) {
                    $days[(string) $d] = true;
                });
        };

        $collect(DB::table('posts')->where('author_id', $user->id)->whereNull('deleted_at'), 'created_at');
        $collect(DB::table('comments')->where('user_id', $user->id), 'created_at');
        $collect(DB::table('likes')->where('user_id', $user->id), 'created_at');
        $collect(DB::table('messages')->where('user_id', $user->id), 'created_at');
        $collect(DB::table('music_plays')->where('user_id', $user->id), 'played_at');
        $collect(DB::table('quest_claims')->where('user_id', $user->id), 'created_at');
        DB::table('play_days')->where('user_id', $user->id)->where('day', '>=', $range[0]->toDateString())
            ->where('day', '<', $range[1]->toDateString())->distinct()->pluck('day')
            ->each(function ($d) use (&$days) {
                $days[substr((string) $d, 0, 10)] = true;
            });

        return count($days);
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return array<string, mixed>
     */
    private function posts(User $user, array $range): array
    {
        $base = Post::query()->where('author_id', $user->id)->where('is_draft', false)->where('is_pending', false)
            ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1]);

        $ids = (clone $base)->pluck('id');
        $reactions = $ids->isEmpty() ? 0 : DB::table('likes')->where('likeable_type', 'post')->whereIn('likeable_id', $ids)->count();

        /** @var Post|null $top */
        $top = (clone $base)->where('likes_count', '>', 0)->orderByDesc('likes_count')->orderByDesc('comments_count')
            ->with('attachments')->first();

        return [
            'count' => $ids->count(),
            'reactions' => $reactions,
            'comments' => DB::table('comments')->where('user_id', $user->id)->whereNull('deleted_at')
                ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1])->count(),
            'top' => $top === null ? null : [
                'id' => $top->id,
                'body' => Str::limit(trim((string) $top->body), 160),
                'likes' => (int) $top->likes_count,
                'comments' => (int) $top->comments_count,
                'image' => $top->attachments->firstWhere('type', 'image')?->url,
                'date' => $top->created_at->toIso8601String(),
            ],
        ];
    }

    /**
     * Друзі, найближчий друг (найбільше повідомлень в особистому чаті), повідомлення й хвилини дзвінків.
     *
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return array<string, mixed>
     */
    private function social(User $user, array $range): array
    {
        $newFriends = DB::table('friendships')->where('status', 'accepted')
            ->where(fn ($q) => $q->where('requester_id', $user->id)->orWhere('addressee_id', $user->id))
            ->where('accepted_at', '>=', $range[0])->where('accepted_at', '<', $range[1])->count();

        $direct = DB::table('conversation_participants as p')->join('conversations as c', 'c.id', '=', 'p.conversation_id')
            ->where('p.user_id', $user->id)->where('c.type', Conversation::TYPE_DIRECT)->pluck('c.id');

        $best = null;
        if ($direct->isNotEmpty()) {
            $top = DB::table('messages')->whereIn('conversation_id', $direct)->whereNull('deleted_at')
                ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1])
                ->groupBy('conversation_id')->selectRaw('conversation_id, COUNT(*) as total')
                ->orderByDesc('total')->first();
            if ($top !== null) {
                $friendId = DB::table('conversation_participants')->where('conversation_id', $top->conversation_id)
                    ->where('user_id', '!=', $user->id)->value('user_id');
                $friend = $friendId ? User::query()->whereKey($friendId)->first() : null;
                if ($friend !== null) {
                    $best = ['user' => $friend->toCard(), 'messages' => (int) $top->total];
                }
            }
        }

        $seconds = 0;
        DB::table('call_participants')->where('user_id', $user->id)->whereNotNull('joined_at')->whereNotNull('left_at')
            ->where('joined_at', '>=', $range[0])->where('joined_at', '<', $range[1])
            ->get(['joined_at', 'left_at'])
            ->each(function ($row) use (&$seconds) {
                $seconds += max(0, CarbonImmutable::parse($row->left_at)->getTimestamp() - CarbonImmutable::parse($row->joined_at)->getTimestamp());
            });

        return [
            'new_friends' => $newFriends,
            'messages' => DB::table('messages')->where('user_id', $user->id)->whereNull('deleted_at')
                ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1])->count(),
            'call_minutes' => intdiv($seconds, 60),
            'best_friend' => $best,
            'profile_visitors' => DB::table('profile_visits')->where('user_id', $user->id)
                ->where('visited_at', '>=', $range[0])->where('visited_at', '<', $range[1])->distinct()->count('visitor_id'),
        ];
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return array<string, mixed>
     */
    private function music(User $user, array $range): array
    {
        $plays = DB::table('music_plays')->where('user_id', $user->id)
            ->where('played_at', '>=', $range[0])->where('played_at', '<', $range[1]);

        $tracks = (clone $plays)->groupBy('title', 'artist')
            ->selectRaw('title, artist, COUNT(*) as plays, MAX(track_id) as track_id, MAX(cover_url) as cover_url')
            ->orderByDesc('plays')->limit(5)->get();
        $covers = Track::query()->whereIn('id', $tracks->pluck('track_id')->filter())->get()->keyBy('id');

        $artist = (clone $plays)->where('artist', '!=', '')->groupBy('artist')
            ->selectRaw('artist, COUNT(*) as plays')->orderByDesc('plays')->first();

        return [
            'plays' => (clone $plays)->count(),
            'top_tracks' => $tracks->map(fn ($t) => [
                'title' => $t->title,
                'artist' => $t->artist,
                'plays' => (int) $t->plays,
                'cover_url' => $t->track_id ? $covers->get($t->track_id)?->cover_url : $t->cover_url,
            ])->values()->all(),
            'top_artist' => $artist ? ['name' => $artist->artist, 'plays' => (int) $artist->plays] : null,
            'added' => DB::table('music_library')->where('user_id', $user->id)
                ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1])->count(),
            'listen_parties' => DB::table('listen_party_members as m')->join('listen_parties as p', 'p.id', '=', 'm.listen_party_id')
                ->where('m.user_id', $user->id)->where('p.created_at', '>=', $range[0])->where('p.created_at', '<', $range[1])->count(),
        ];
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return array<string, mixed>
     */
    private function cinema(User $user, array $range): array
    {
        $watched = DB::table('movie_user')->where('user_id', $user->id)->where('status', 'watched')
            ->where('watched_at', '>=', $range[0])->where('watched_at', '<', $range[1]);

        $favoriteIds = (clone $watched)->whereNotNull('rating')->orderByDesc('rating')->orderByDesc('watched_at')
            ->limit(3)->pluck('movie_id');
        if ($favoriteIds->isEmpty()) {
            $favoriteIds = (clone $watched)->orderByDesc('watched_at')->limit(3)->pluck('movie_id');
        }
        $movies = Movie::query()->whereIn('id', $favoriteIds)->get()->keyBy('id');

        return [
            'watched' => (clone $watched)->count(),
            'favorites' => $favoriteIds->map(fn ($id) => $movies->get($id))->filter()
                ->map(fn (Movie $m) => ['title' => $m->title, 'slug' => $m->slug, 'poster' => $m->poster, 'year' => $m->year])
                ->values()->all(),
            'watch_parties' => DB::table('watch_party_members as m')->join('watch_parties as p', 'p.id', '=', 'm.watch_party_id')
                ->where('m.user_id', $user->id)->where('p.created_at', '>=', $range[0])->where('p.created_at', '<', $range[1])->count(),
        ];
    }

    /**
     * Ігри й сервери за днями гри, голоси за сервер і моменти.
     *
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return array<string, mixed>
     */
    private function games(User $user, array $range): array
    {
        $days = fn (string $kind) => DB::table('play_days')->where('user_id', $user->id)->where('kind', $kind)
            ->where('day', '>=', $range[0]->toDateString())->where('day', '<', $range[1]->toDateString())
            ->groupBy('subject_id')->selectRaw('subject_id, COUNT(*) as days')->orderByDesc('days');

        $topList = $days(PlayedPlace::GAME)->limit(5)->get();
        $topGames = $topList->take(3);
        $games = Game::query()->whereIn('id', $topList->pluck('subject_id'))->get()->keyBy('id');
        $topServer = $days(PlayedPlace::SERVER)->first();

        $votes = DB::table('server_votes')->where('user_id', $user->id)
            ->where('voted_on', '>=', $range[0]->toDateString())->where('voted_on', '<', $range[1]->toDateString());
        $votedServer = (clone $votes)->groupBy('gta_server_id')->selectRaw('gta_server_id, COUNT(*) as total')->orderByDesc('total')->first();

        $serverId = $topServer->subject_id ?? $votedServer->gta_server_id ?? null;
        $server = $serverId ? GtaServer::query()->whereKey($serverId)->first() : null;

        $moments = DB::table('moments')->where('user_id', $user->id)
            ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1]);
        $topMoment = (clone $moments)->where('likes_count', '>', 0)->orderByDesc('likes_count')->first(['id', 'title', 'thumbnail', 'likes_count']);

        return [
            'play_days' => DB::table('play_days')->where('user_id', $user->id)
                ->where('day', '>=', $range[0]->toDateString())->where('day', '<', $range[1]->toDateString())->distinct()->count('day'),
            'top_games' => $topGames->map(fn ($row) => $games->get($row->subject_id))->filter()
                ->map(fn (Game $g) => ['name' => $g->name, 'slug' => $g->slug, 'cover' => $g->cover])
                ->values()->all(),
            'top_server' => $server === null ? null : [
                'name' => $server->name,
                'slug' => $server->slug,
                'icon' => $server->icon,
                'days' => (int) ($topServer->days ?? 0),
            ],
            // Ігровий рік: скільки різних ігор, топ-5 за днями і з ким найчастіше грали в одну гру того самого дня.
            'games_count' => DB::table('play_days')->where('user_id', $user->id)->where('kind', PlayedPlace::GAME)
                ->where('day', '>=', $range[0]->toDateString())->where('day', '<', $range[1]->toDateString())->distinct()->count('subject_id'),
            'top_list' => $topList->map(fn ($row) => ($game = $games->get($row->subject_id)) === null ? null
                : ['name' => $game->name, 'slug' => $game->slug, 'cover' => $game->cover, 'days' => (int) $row->days])
                ->filter()->values()->all(),
            'teammates' => $this->teammates($user, $range),
            'votes' => (clone $votes)->count(),
            'moments' => (clone $moments)->count(),
            'top_moment' => $topMoment === null ? null : [
                'id' => $topMoment->id,
                'title' => $topMoment->title,
                'thumbnail' => $topMoment->thumbnail,
                'likes' => (int) $topMoment->likes_count,
            ],
        ];
    }

    /**
     * Друзі, які найчастіше грали в ту саму гру того самого дня.
     *
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return list<array{user: array<string, mixed>, days: int}>
     */
    private function teammates(User $user, array $range): array
    {
        $friends = app(FriendshipService::class)->friendIds($user);
        if ($friends === []) {
            return [];
        }
        $rows = DB::table('play_days as mine')
            ->join('play_days as other', function ($join) {
                $join->on('other.day', '=', 'mine.day')->on('other.kind', '=', 'mine.kind')->on('other.subject_id', '=', 'mine.subject_id');
            })
            ->where('mine.user_id', $user->id)->where('mine.kind', PlayedPlace::GAME)
            ->where('mine.day', '>=', $range[0]->toDateString())->where('mine.day', '<', $range[1]->toDateString())
            ->whereIn('other.user_id', $friends)
            ->groupBy('other.user_id')->selectRaw('other.user_id as friend, COUNT(DISTINCT mine.day) as days')
            ->orderByDesc('days')->limit(3)->get();
        $users = User::query()->whereIn('id', $rows->pluck('friend'))->get()->keyBy('id');

        $out = [];
        foreach ($rows as $row) {
            $friend = $users->get($row->friend);
            if ($friend !== null) {
                $out[] = ['user' => $friend->toCard(), 'days' => (int) $row->days];
            }
        }

        return $out;
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $range
     * @return array<string, int>
     */
    private function progress(User $user, array $range): array
    {
        $claims = DB::table('quest_claims')->where('user_id', $user->id)
            ->where('created_at', '>=', $range[0])->where('created_at', '<', $range[1]);

        return [
            'xp' => (int) (clone $claims)->sum('xp'),
            'quests' => (clone $claims)->count(),
        ];
    }

    /**
     * Хто ти цього року — за тим, чого було найбільше.
     *
     * @param  array<string, mixed>  $posts
     * @param  array<string, mixed>  $social
     * @param  array<string, mixed>  $music
     * @param  array<string, mixed>  $cinema
     * @param  array<string, mixed>  $games
     */
    private function persona(array $posts, array $social, array $music, array $cinema, array $games): string
    {
        $scores = [
            'melomaniac' => $music['plays'] / 10 + $music['added'] + $music['listen_parties'] * 3,
            'cinephile' => $cinema['watched'] * 4 + $cinema['watch_parties'] * 3,
            'author' => $posts['count'] * 3 + $posts['reactions'] / 5,
            'soul' => $social['messages'] / 25 + $social['new_friends'] * 3 + $social['call_minutes'] / 15,
            'gamer' => $games['play_days'] * 2 + $games['votes'] / 2 + $games['moments'] * 3,
        ];
        arsort($scores);
        $top = (string) array_key_first($scores);

        return $scores[$top] >= 5 ? $top : 'newcomer';
    }
}
