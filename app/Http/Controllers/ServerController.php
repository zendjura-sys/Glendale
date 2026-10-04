<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Services\EventCalendar;
use App\Services\Families\FamilyRating;
use App\Services\FriendshipService;
use App\Services\Presence\PlayingStatus;
use App\Services\Servers\DiscordInvites;
use App\Services\Servers\ServerDirectory;
use App\Services\Servers\ServerIconFetcher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        ]);
        $sort = $filters['sort'] ?? 'online';

        $servers = GtaServer::query()->published()
            ->withCount(['families' => fn (Builder $q) => $q->where('status', Family::STATUS_VERIFIED)])
            ->when($filters['platform'] ?? null, fn (Builder $q, string $p) => $q->where('platform', $p))
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->where('name', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%'))
            ->get();

        $servers = match ($sort) {
            'name' => $servers->sortBy(fn (GtaServer $s) => Str::lower($s->name)),
            'new' => $servers->sortByDesc('created_at'),
            'families' => $servers->sortByDesc('families_count'),
            default => $servers->sortBy(fn (GtaServer $s) => [$s->is_featured ? 0 : 1, -1 * ($s->players_online ?? -1), -1 * ($s->discord_online ?? 0), $s->position]),
        };

        $all = GtaServer::query()->published();

        return Inertia::render('servers/index', [
            'servers' => $servers->values()->map(fn (GtaServer $s) => $s->toCard()),
            'filters' => ['platform' => $filters['platform'] ?? null, 'q' => $filters['q'] ?? '', 'sort' => $sort],
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
            ],
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
            'playing_now' => $playing->playingNow('server', $server->id, $friendships->friendIds($request->user())),
            'playing_count' => $playing->countNow('server', $server->id),
        ]);
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
