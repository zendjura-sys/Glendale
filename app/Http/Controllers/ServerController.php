<?php

namespace App\Http\Controllers;

use App\Models\Clan;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\PlayedPlace;
use App\Models\Save;
use App\Models\ServerClaim;
use App\Models\ServerEvent;
use App\Models\ServerNews;
use App\Models\ServerReview;
use App\Models\User;
use App\Notifications\GroupInvite;
use App\Services\EventCalendar;
use App\Services\Events\DiscordEventSync;
use App\Services\Families\FamilyRating;
use App\Services\FollowAlerts;
use App\Services\FriendshipService;
use App\Services\Presence\PlayingStatus;
use App\Services\SavedItems;
use App\Services\Servers\DiscordInvites;
use App\Services\Servers\ServerDirectory;
use App\Services\Servers\ServerIconFetcher;
use App\Support\I18n\Locales;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ServerController extends Controller
{
    public function __construct(
        private readonly ServerDirectory $directory,
        private readonly ServerIconFetcher $icons,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'platform' => ['nullable', Rule::in(array_keys(GtaServer::PLATFORMS))],
            'q' => ['nullable', 'string', 'max:60'],
            'sort' => ['nullable', Rule::in(['online', 'name', 'new', 'families'])],
            'lang' => ['nullable', 'string', Rule::in(['all', ...array_keys(GtaServer::LANGUAGES)])],
            'tag' => ['nullable', Rule::in(['rp', 'pvp', 'mixed'])],
        ]);
        $sort = $filters['sort'] ?? 'online';
        $plugins = app(Plugins::class);
        $favoritesOn = $plugins->on('server_favorites');
        $savedOnly = $favoritesOn && $request->boolean('saved');
        if (! $plugins->on('server_tags')) {
            $filters['tag'] = null;
        }
        $favoriteIds = $favoritesOn
            ? Save::query()->where('user_id', $request->user()->id)->where('kind', Save::SERVER)->latest('id')->limit(24)->pluck('subject_id')
            : collect();

        // Мова серверів: вибрана або мова інтерфейсу, якщо такі сервери є; інакше — усі.
        $languages = GtaServer::query()->published()->selectRaw('language, count(*) as total')->groupBy('language')->pluck('total', 'language')->map(fn ($n) => (int) $n);
        $mine = Locales::primary(app()->getLocale());
        $lang = $filters['lang'] ?? ($languages->has($mine) ? $mine : 'all');
        $byLanguage = fn (Builder $q) => $lang === 'all' ? $q : $q->where('language', $lang);

        $servers = GtaServer::query()->published()->tap($byLanguage)
            ->withCount(['families' => fn (Builder $q) => $q->where('status', Family::STATUS_VERIFIED)])
            ->when($filters['platform'] ?? null, fn (Builder $q, string $p) => $q->where('platform', $p))
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->where('name', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%'))
            ->when($savedOnly, fn (Builder $q) => $q->whereIn('id', $favoriteIds))
            ->when($filters['tag'] ?? null, fn (Builder $q, string $tag) => $q->where('tags->mode', $tag))
            ->get();

        $servers = match ($sort) {
            'name' => $servers->sortBy(fn (GtaServer $s) => Str::lower($s->name)),
            'new' => $servers->sortByDesc('created_at'),
            'families' => $servers->sortByDesc('families_count'),
            default => $servers->sortBy(fn (GtaServer $s) => [$s->is_featured ? 0 : 1, -1 * ($s->players_online ?? -1), -1 * ($s->discord_online ?? 0), $s->position]),
        };

        $all = GtaServer::query()->published()->tap($byLanguage);

        return Inertia::render('servers/index', [
            'servers' => $servers->values()->map(fn (GtaServer $s) => $s->toCard()),
            'filters' => ['platform' => $filters['platform'] ?? null, 'q' => $filters['q'] ?? '', 'sort' => $sort, 'lang' => $lang, 'saved' => $savedOnly, 'tag' => $filters['tag'] ?? null],
            'favorites' => $favoritesOn ? GtaServer::query()->published()->whereIn('id', $favoriteIds)->get()
                ->sortBy(fn (GtaServer $server) => $favoriteIds->search($server->id))
                ->values()
                ->map(fn (GtaServer $server) => $server->toCard()) : [],
            // «Німецькі» — перекладається мовою інтерфейсу; «усі» — без прикметника.
            'heading' => $lang === 'all' ? null : GtaServer::LANGUAGES[$lang],
            'languages' => $languages->sortDesc()->map(fn (int $count, string $code) => ['code' => $code, 'native' => Locales::nativeName($code), 'count' => $count])->values(),
            'stats' => [
                'servers' => (clone $all)->count(),
                'pc' => (clone $all)->where('platform', 'pc')->count(),
                'mobile' => (clone $all)->where('platform', 'mobile')->count(),
                'online' => (int) (clone $all)->sum('players_online'),
                'families' => Family::query()->where('status', Family::STATUS_VERIFIED)->count(),
            ],
            'my_suggestions' => GtaServer::query()
                ->where('suggested_by', $request->user()->id)
                ->whereIn('status', [GtaServer::STATUS_PENDING, GtaServer::STATUS_REJECTED])
                ->latest()->limit(5)->get()
                ->map(fn (GtaServer $s) => ['id' => $s->id, 'name' => $s->name, 'status' => $s->status, 'review_note' => $s->review_note]),
            'options' => [
                'platforms' => GtaServer::PLATFORMS,
                'multiplayers' => GtaServer::MULTIPLAYERS,
                'languages' => GtaServer::languageOptions(),
            ],
        ]);
    }

    public function compare(Request $request): Response
    {
        app(Plugins::class)->ensure('server_compare');
        $data = $request->validate([
            'a' => ['nullable', 'string', 'max:80'],
            'b' => ['nullable', 'string', 'max:80'],
        ]);
        $left = $this->publishedBySlug($data['a'] ?? null);
        $right = $this->publishedBySlug($data['b'] ?? null);
        abort_if($left instanceof GtaServer && $right instanceof GtaServer && $left->is($right), 422);

        return Inertia::render('servers/compare', [
            'left' => $left instanceof GtaServer ? $this->compareCard($left) : null,
            'right' => $right instanceof GtaServer ? $this->compareCard($right) : null,
            'servers' => GtaServer::query()->published()->orderBy('name')->limit(200)->get(['slug', 'name'])
                ->map(fn (GtaServer $server) => ['slug' => $server->slug, 'name' => $server->name])
                ->values(),
        ]);
    }

    public function show(Request $request, GtaServer $server, FamilyRating $rating, EventCalendar $calendar, PlayingStatus $playing, FriendshipService $friendships): Response
    {
        abort_unless($server->status === GtaServer::STATUS_PUBLISHED || $request->user()->isAdmin(), 404);

        $families = Family::query()
            ->with('server')
            ->where('server_id', $server->id)
            ->where('status', Family::STATUS_VERIFIED)
            ->get()
            ->map(fn (Family $f) => [...$f->toCard(), 'score' => Cache::remember("family.score.{$f->id}", now()->addMinutes(15), fn () => $rating->familyScore($f))])
            ->sortByDesc('score')
            ->values();

        return Inertia::render('servers/show', [
            'server' => [
                ...$server->toCard(),
                'description' => $server->description,
                'icon_source' => $server->icon_source,
                'origin' => $server->origin,
            ],
            'families' => $families,
            'events' => $calendar->forServer($server, $request->user()),
            'event_hosts' => $calendar->hosts($server, $request->user()),
            'event_types' => ServerEvent::TYPES,
            // Події з Discord проєкту підтягуються, коли туди додано бота GameCon.
            'discord_events' => [
                'connected' => $server->discord_events_at !== null && $server->discord_events_at->gt(now()->subDay()),
                'invite' => $server->discord_invite ? app(DiscordEventSync::class)->botInviteUrl() : null,
            ],
            'playing_now' => $playing->playingNow('server', $server->id, $friendships->friendIds($request->user())),
            'playing_count' => $playing->countNow('server', $server->id),
            'saved' => app(SavedItems::class)->has($request->user(), 'server', $server->id),
            'following' => app(FollowAlerts::class)->has($request->user(), 'server', $server->id),
            'pinned' => is_array($pin = $request->user()->pref('pin')) && ($pin['kind'] ?? null) === 'server' && (int) ($pin['id'] ?? 0) === $server->id,
            'invites' => $this->inviteTargets($request->user(), $server),
            'reviews' => $this->reviews($server, $request->user()),
            'ownership' => $this->ownership($server, $request->user()),
            'online' => $this->onlineSeries($server),
            'similar' => $this->similarServers($server),
        ]);
    }

    public function tags(Request $request, GtaServer $server): RedirectResponse
    {
        app(Plugins::class)->ensure('server_tags');
        $user = $request->user();
        abort_unless($server->owner_id === $user->id || $user->isStaff(), 403);
        $data = $request->validate([
            'mode' => ['required', Rule::in(['rp', 'pvp', 'mixed'])],
            'region' => ['nullable', 'string', 'max:40'],
        ]);
        $server->forceFill(['tags' => [
            'mode' => $data['mode'],
            'region' => trim((string) ($data['region'] ?? '')) ?: null,
        ]])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Теги збережено.']);

        return back();
    }

    public function claim(Request $request, GtaServer $server): RedirectResponse
    {
        app(Plugins::class)->ensure('server_claim');
        abort_unless($server->status === GtaServer::STATUS_PUBLISHED, 404);
        $user = $request->user();
        abort_if($server->owner_id === $user->id, 422);
        $data = $request->validate(['message' => ['nullable', 'string', 'max:500']]);
        ServerClaim::query()->updateOrCreate(
            ['user_id' => $user->id, 'gta_server_id' => $server->id],
            ['message' => trim((string) ($data['message'] ?? '')) ?: null, 'status' => ServerClaim::PENDING],
        );
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку надіслано.']);

        return back();
    }

    public function decideClaim(Request $request, GtaServer $server, ServerClaim $claim): RedirectResponse
    {
        app(Plugins::class)->ensure('server_claim');
        abort_unless($request->user()->isStaff(), 403);
        abort_unless($claim->gta_server_id === $server->id, 404);
        $data = $request->validate(['status' => ['required', Rule::in([ServerClaim::APPROVED, ServerClaim::REJECTED])]]);
        if ($data['status'] === ServerClaim::APPROVED) {
            $server->forceFill(['owner_id' => $claim->user_id])->save();
            ServerClaim::query()->where('gta_server_id', $server->id)->whereKeyNot($claim->id)->where('status', ServerClaim::PENDING)->update(['status' => ServerClaim::REJECTED]);
        }
        $claim->update(['status' => $data['status']]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку розглянуто.']);

        return back();
    }

    public function news(Request $request, GtaServer $server): RedirectResponse
    {
        app(Plugins::class)->ensure('server_news');
        abort_unless($server->owner_id === $request->user()->id, 403);
        $data = $request->validate(['body' => ['required', 'string', 'max:1000']]);
        ServerNews::query()->create([
            'gta_server_id' => $server->id,
            'user_id' => $request->user()->id,
            'body' => trim($data['body']),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Новину опубліковано.']);

        return back();
    }

    public function review(Request $request, GtaServer $server): RedirectResponse
    {
        $user = $request->user();
        abort_unless(
            PlayedPlace::query()->where('user_id', $user->id)->where('kind', PlayedPlace::SERVER)->where('subject_id', $server->id)->exists(),
            403,
            'Відгук можуть лишити ті, хто ставив «граю тут».',
        );
        $data = $request->validate([
            'stars' => ['required', 'integer', 'min:1', 'max:5'],
            'body' => ['required', 'string', 'max:500'],
        ]);
        ServerReview::query()->updateOrCreate(
            ['user_id' => $user->id, 'gta_server_id' => $server->id],
            ['stars' => (int) $data['stars'], 'body' => trim($data['body'])],
        );
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Відгук збережено.']);

        return back();
    }

    /**
     * @return array{average: float|null, count: int, can_review: bool, items: list<array{name: string, username: string, stars: int, body: string}>}
     */
    private function reviews(GtaServer $server, User $viewer): array
    {
        $rows = ServerReview::query()->with('user')->where('gta_server_id', $server->id)->latest('id')->limit(8)->get();

        return [
            'average' => $rows->isEmpty() ? null : round((float) ServerReview::query()->where('gta_server_id', $server->id)->avg('stars'), 1),
            'count' => ServerReview::query()->where('gta_server_id', $server->id)->count(),
            'can_review' => PlayedPlace::query()->where('user_id', $viewer->id)->where('kind', PlayedPlace::SERVER)->where('subject_id', $server->id)->exists(),
            'items' => array_values($rows->map(fn (ServerReview $review) => [
                'name' => $review->user->name,
                'username' => $review->user->username,
                'stars' => $review->stars,
                'body' => $review->body,
            ])->all()),
        ];
    }

    public function invite(Request $request, GtaServer $server, FriendshipService $friendships): RedirectResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['family', 'clan'])],
            'id' => ['required', 'integer'],
            'username' => ['required', 'string', 'max:32'],
        ]);
        $friend = User::query()->whereRaw('lower(username) = ?', [mb_strtolower($data['username'])])->first();
        abort_unless($friend && $friendships->status($request->user(), $friend) === FriendshipService::FRIENDS, 422, 'Запросити можна лише друга.');

        $target = collect($this->inviteTargets($request->user(), $server))->first(fn (array $item) => $item['kind'] === $data['kind'] && $item['id'] === (int) $data['id']);
        abort_unless(is_array($target), 403);

        $friend->notify(new GroupInvite($request->user(), $target['name'], $target['href']));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запрошення надіслано.']);

        return back();
    }

    /**
     * @return list<array{kind: string, id: int, name: string, href: string}>
     */
    private function inviteTargets(User $user, GtaServer $server): array
    {
        $families = FamilyMember::query()
            ->where('user_id', $user->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->where('rank', '>=', Family::LEADER_RANK)
            ->whereHas('family', fn (Builder $q) => $q->where('server_id', $server->id)->where('status', Family::STATUS_VERIFIED))
            ->with('family')
            ->get()
            ->map(fn (FamilyMember $member) => [
                'kind' => 'family',
                'id' => $member->family_id,
                'name' => $member->family->name,
                'href' => '/f/'.$member->family->slug,
            ]);
        $clans = Clan::query()->where('owner_id', $user->id)->get()->map(fn (Clan $clan) => [
            'kind' => 'clan',
            'id' => $clan->id,
            'name' => $clan->name,
            'href' => '/clans/'.$clan->slug,
        ]);

        return [...$families->all(), ...$clans->all()];
    }

    /**
     * Гравець пропонує сервер, якого немає в каталозі — після модерації його опублікують.
     */
    public function suggest(Request $request): RedirectResponse
    {
        $data = $request->validate($this->rules(), $this->messages());

        abort_if(
            GtaServer::query()->where('suggested_by', $request->user()->id)->where('status', GtaServer::STATUS_PENDING)->count() >= 5,
            429,
            'У вас уже 5 пропозицій на розгляді.',
        );

        $duplicate = $this->duplicate($data);
        if ($duplicate) {
            Inertia::flash('toast', ['type' => 'error', 'message' => "«{$duplicate->name}» уже є в каталозі або на модерації."]);

            return back();
        }

        $server = GtaServer::query()->create([
            ...$this->payload($data),
            'slug' => $this->directory->uniqueSlug($data['name']),
            'status' => GtaServer::STATUS_PENDING,
            'origin' => 'suggested',
            'suggested_by' => $request->user()->id,
        ]);
        rescue(fn () => $this->icons->fetch($server), report: false);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Дякуємо! «{$server->name}» з’явиться в каталозі після перевірки."]);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'platform' => ['required', Rule::in(array_keys(GtaServer::PLATFORMS))],
            'multiplayer' => ['required', Rule::in(array_keys(GtaServer::MULTIPLAYERS))],
            'language' => ['nullable', Rule::in(array_keys(GtaServer::LANGUAGES))],
            'tagline' => ['nullable', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:3000'],
            'website' => ['nullable', 'string', 'max:255', 'url:http,https'],
            'discord' => ['nullable', 'string', 'max:120', function (string $attribute, mixed $value, \Closure $fail) {
                if (filled($value) && DiscordInvites::code((string) $value) === null) {
                    $fail('Запрошення Discord має вигляд discord.gg/код.');
                }
            }],
            'telegram' => ['nullable', 'string', 'max:255', 'regex:#^(https://t\.me/[\w+]{3,64}|@\w{3,64})$#'],
            'connect' => ['nullable', 'string', 'max:120', 'regex:/^[\w.\-:\/]+$/'],
            'icon_url' => ['nullable', 'string', 'max:500', 'url:https'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'website.url' => 'Вкажіть адресу сайту, напр. https://example.com',
            'telegram.regex' => 'Telegram — посилання https://t.me/… або @канал.',
            'connect.regex' => 'Адреса для підключення: ip:port, домен:port або код cfx.re.',
            'icon_url.url' => 'Посилання на іконку має починатися з https://',
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function payload(array $data): array
    {
        $telegram = $data['telegram'] ?? null;
        if (is_string($telegram) && str_starts_with($telegram, '@')) {
            $telegram = 'https://t.me/'.substr($telegram, 1);
        }

        return [
            'name' => trim((string) $data['name']),
            'platform' => $data['platform'],
            'multiplayer' => $data['multiplayer'],
            'tagline' => $data['tagline'] ?? null,
            'description' => $data['description'] ?? null,
            'website' => $data['website'] ?? null,
            'discord_invite' => DiscordInvites::code($data['discord'] ?? null),
            'telegram' => $telegram,
            'connect' => filled($data['connect'] ?? null) ? trim((string) $data['connect']) : null,
            'icon_url' => $data['icon_url'] ?? null,
            ...(isset($data['language']) ? ['language' => (string) $data['language']] : []),
        ];
    }

    /**
     * @return array{owner: array<string, mixed>|null, is_owner: bool, can_tag: bool, claim: string|null, news: list<array{id: int, body: string, name: string, created_at: string}>, pending: list<array{id: int, name: string, username: string, message: string|null}>}
     */
    private function ownership(GtaServer $server, User $viewer): array
    {
        $plugins = app(Plugins::class);
        $server->loadMissing('owner');
        $mine = $plugins->on('server_claim')
            ? ServerClaim::query()->where('user_id', $viewer->id)->where('gta_server_id', $server->id)->first()
            : null;
        $pending = $viewer->isStaff() && $plugins->on('server_claim')
            ? ServerClaim::query()->with('user')->where('gta_server_id', $server->id)->where('status', ServerClaim::PENDING)->latest('id')->limit(10)->get()
            : collect();

        return [
            'owner' => $server->owner?->toCard(),
            'is_owner' => $server->owner_id === $viewer->id,
            'can_tag' => $plugins->on('server_tags') && ($server->owner_id === $viewer->id || $viewer->isStaff()),
            'claim' => $mine?->status,
            'news' => $plugins->on('server_news')
                ? array_values(ServerNews::query()->with('user')->where('gta_server_id', $server->id)->latest('id')->limit(5)->get()
                    ->map(fn (ServerNews $item) => [
                        'id' => $item->id,
                        'body' => $item->body,
                        'name' => $item->user->name,
                        'created_at' => $item->created_at->toIso8601String(),
                    ])->all())
                : [],
            'pending' => array_values($pending->map(fn (ServerClaim $claim) => [
                'id' => $claim->id,
                'name' => $claim->user->name,
                'username' => $claim->user->username,
                'message' => $claim->message,
            ])->all()),
        ];
    }

    /**
     * @return list<array{day: string, players: int}>
     */
    private function onlineSeries(GtaServer $server): array
    {
        if (! app(Plugins::class)->on('server_online')) {
            return [];
        }

        return array_values(DB::table('server_online_samples')
            ->where('gta_server_id', $server->id)
            ->orderByDesc('sampled_on')
            ->limit(14)
            ->get(['sampled_on', 'players_online'])
            ->reverse()
            ->map(fn ($row) => ['day' => (string) $row->sampled_on, 'players' => (int) $row->players_online])
            ->values()
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function similarServers(GtaServer $server): array
    {
        if (! app(Plugins::class)->on('similar_servers')) {
            return [];
        }

        return array_values(GtaServer::query()->published()
            ->whereKeyNot($server->id)
            ->where(function (Builder $query) use ($server) {
                $query->where('multiplayer', $server->multiplayer)->orWhere('language', $server->language);
            })
            ->orderByRaw('case when multiplayer = ? then 0 else 1 end', [$server->multiplayer])
            ->orderByDesc('players_online')
            ->limit(4)
            ->get()
            ->map(fn (GtaServer $item) => $item->toCard())
            ->all());
    }

    private function publishedBySlug(?string $slug): ?GtaServer
    {
        if ($slug === null || $slug === '') {
            return null;
        }

        return GtaServer::query()->published()->where('slug', $slug)->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function compareCard(GtaServer $server): array
    {
        $average = ServerReview::query()->where('gta_server_id', $server->id)->avg('stars');

        return [
            ...$server->toCard(),
            'language_label' => GtaServer::LANGUAGES[$server->language] ?? $server->language,
            'rating' => $average === null ? null : round((float) $average, 1),
            'reviews' => ServerReview::query()->where('gta_server_id', $server->id)->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function duplicate(array $data): ?GtaServer
    {
        $host = isset($data['website']) ? preg_replace('/^www\./', '', (string) parse_url((string) $data['website'], PHP_URL_HOST)) : null;

        return GtaServer::query()
            ->where('status', '!=', GtaServer::STATUS_REJECTED)
            ->where(function (Builder $q) use ($data, $host) {
                $q->whereRaw('lower(name) = ?', [Str::lower(trim((string) $data['name']))]);
                if (filled($data['connect'] ?? null)) {
                    $q->orWhere('connect', trim((string) $data['connect']));
                }
                if ($host) {
                    $q->orWhere('website', 'like', '%'.$host.'%');
                }
            })
            ->first();
    }
}
