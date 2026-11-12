<?php

namespace App\Http\Controllers;

use App\Models\Clan;
use App\Models\ClanAlliance;
use App\Models\ClanContribution;
use App\Models\ClanEvent;
use App\Models\ClanLog;
use App\Models\ClanMatch;
use App\Models\ClanMember;
use App\Models\ClanNews;
use App\Models\ClanShift;
use App\Models\Game;
use App\Models\User;
use App\Notifications\ComeBackNudge;
use App\Services\Clans\ClanMvp;
use App\Services\Clans\ClanService;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Клани й гільдії: пошук, створення з вибором гри й розділів, сторінка клану й усе керування.
 */
class ClanController extends Controller
{
    public function __construct(private readonly ClanService $clans) {}

    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:60'],
            'type' => ['nullable', Rule::in(array_keys(Clan::TYPES))],
            'game' => ['nullable', 'string', 'max:120'],
        ]);
        $game = isset($filters['game']) ? Game::query()->where('slug', $filters['game'])->first() : null;

        $mine = Clan::query()->with('game')
            ->whereHas('members', fn (Builder $q) => $q->where('user_id', $user->id)->whereIn('status', [ClanMember::STATUS_ACTIVE, ClanMember::STATUS_PENDING]))
            ->orderBy('name')->get()
            ->map(fn (Clan $c) => [...$c->toCard(), 'pending' => ! $this->clans->member($c, $user)])
            ->values();

        $discover = Clan::query()->with('game')
            ->when($filters['q'] ?? null, fn (Builder $q, string $t) => $q->where(fn (Builder $w) => $w->where('name', 'like', "%{$t}%")->orWhere('tag', 'like', "%{$t}%")))
            ->when($filters['type'] ?? null, fn (Builder $q, string $t) => $q->where('type', $t))
            ->when($game, fn (Builder $q) => $q->where('game_id', $game?->id))
            ->orderByDesc('members_count')
            ->paginate(24)
            ->withQueryString()
            ->through(fn (Clan $c) => $c->toCard());

        return Inertia::render('clans/index', [
            'mine' => $mine,
            'clans' => $discover,
            'filters' => ['q' => $filters['q'] ?? '', 'type' => $filters['type'] ?? null, 'game' => $game?->toCard()],
            'types' => Clan::TYPES,
        ]);
    }

    public function create(Request $request): Response
    {
        $game = Game::query()->published()->where('slug', (string) $request->query('game', ''))->first();

        return Inertia::render('clans/create', [
            'types' => Clan::TYPES,
            'features' => Clan::FEATURES,
            'default_features' => Clan::DEFAULT_FEATURES,
            'join_modes' => Clan::JOIN_MODES,
            'game' => $game?->toCard(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Clan::TYPES))],
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'tag' => ['required', 'string', 'min:2', 'max:6', 'regex:/^[\pL\pN]+$/u'],
            'game_id' => ['required', 'integer'],
            'description' => ['nullable', 'string', 'max:1000'],
            'features' => ['nullable', 'array'],
            'features.*' => [Rule::in(array_keys(Clan::FEATURES))],
            'join_mode' => ['required', Rule::in(array_keys(Clan::JOIN_MODES))],
            'logo' => ['nullable', 'image', 'max:5120'],
        ], ['tag.regex' => 'Тег — лише літери й цифри без пробілів.']);

        $clan = $this->clans->create($this->user($request), [
            'type' => $data['type'],
            'name' => trim($data['name']),
            'tag' => $data['tag'],
            'game_id' => (int) $data['game_id'],
            'description' => $data['description'] ?? null,
            'features' => array_values($data['features'] ?? []),
            'join_mode' => $data['join_mode'],
        ], $request->file('logo'));
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$clan->display_name} створено!"]);

        return to_route('clans.show', $clan);
    }

    public function mvp(Request $request, Clan $clan, ClanMvp $mvp): RedirectResponse
    {
        app(Plugins::class)->ensure('clan_mvp');
        abort_unless((bool) $clan->setting('mvp'), 404, 'Голосування вимкнено в налаштуваннях клану.');
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $mvp->vote($clan, $this->user($request), User::query()->findOrFail((int) $data['user_id']));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Голос зараховано. Переможця оголосимо на початку наступного місяця.']);

        return back();
    }

    public function show(Request $request, Clan $clan): Response
    {
        $user = $this->user($request);
        $clan->load('game', 'owner');
        $me = $this->clans->member($clan, $user);
        $can = $this->clans->abilities($me, $clan);
        $application = $me ? null : ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $user->id)->where('status', ClanMember::STATUS_PENDING)->first();
        $member = $me !== null;

        $events = $member && $clan->hasFeature('events')
            ? ClanEvent::query()->where('clan_id', $clan->id)->where('starts_at', '>=', now()->subHours(6))->withCount('going')
                ->with(['going' => fn ($q) => $q->where('users.id', $user->id)])
                ->orderBy('starts_at')->limit(20)->get()
                ->map(fn (ClanEvent $e) => [
                    'id' => $e->id, 'title' => $e->title, 'description' => $e->description,
                    'starts_at' => $e->starts_at->toIso8601String(), 'going_count' => (int) $e->getAttribute('going_count'),
                    'going' => $e->going->isNotEmpty(),
                    'repeat' => $e->repeat,
                    'bracket' => $e->bracket,
                    'cover_url' => $e->cover_path !== null ? Storage::disk('public')->url($e->cover_path) : null,
                    'ics_url' => '/events/clan/'.$e->id.'.ics',
                ])
            : [];

        return Inertia::render('clans/show', [
            'clan' => [
                ...$clan->toCard(),
                'description' => $clan->description,
                'rules' => $clan->hasFeature('rules') ? $clan->rules : null,
                'features' => $clan->features,
                'options' => $clan->resolvedSettings(),
                'currency' => $clan->currency,
                'treasury' => $member && $clan->hasFeature('treasury') ? $clan->treasury : null,
                'owner' => $clan->owner?->toCard(),
                'rank_titles' => $clan->rankTitles(),
                'conversation_id' => $member && $clan->hasFeature('chat') ? $clan->conversation_id : null,
                'created_at' => $clan->created_at?->toIso8601String(),
                'questions' => array_values(array_filter(array_map(
                    fn (string $question) => trim($question),
                    $clan->questions ?? [],
                ))),
            ],
            'me' => $me ? [...$me->toCard($clan), 'can' => $can] : null,
            // «Гравець місяця»: переможець минулого місяця й голосування за поточний.
            'mvp' => $member && $clan->setting('mvp') && app(Plugins::class)->on('clan_mvp') ? app(ClanMvp::class)->state($clan, $user) : null,
            'application' => $application ? ['applied_at' => $application->created_at->toIso8601String()] : null,
            'features' => Clan::FEATURES,
            'join_modes' => Clan::JOIN_MODES,
            'members' => $member
                ? $clan->activeMembers()->with('user')->orderByDesc('rank')->orderBy('joined_at')->get()->map(fn (ClanMember $m) => [
                    ...$m->toCard($clan),
                    'away' => $clan->setting('nudge') && $m->user !== null && ($m->user->last_seen_at === null || $m->user->last_seen_at->lt(now()->subDays(ComeBackNudge::DAYS))),
                ])->values()
                : [],
            'applications' => $can['members.manage']
                ? ClanMember::query()->with('user')->where('clan_id', $clan->id)->where('status', ClanMember::STATUS_PENDING)->oldest()->get()->map(fn (ClanMember $m) => $m->toCard($clan))->values()
                : [],
            'news' => $member && $clan->hasFeature('news')
                ? ClanNews::query()->with('user')->where('clan_id', $clan->id)->orderByDesc('is_pinned')->latest('id')->limit(30)->get()
                    ->map(fn (ClanNews $n) => ['id' => $n->id, 'title' => $n->title, 'body' => $n->body, 'is_pinned' => $n->is_pinned, 'user' => $n->user?->toCard(), 'created_at' => $n->created_at->toIso8601String(), 'mine' => $n->user_id === $user->id])
                : [],
            'events' => $events,
            'shifts' => $member && $clan->hasFeature('shifts')
                ? ClanShift::query()->with('user')->where('clan_id', $clan->id)
                    ->where('ends_at', '>=', now())->where('starts_at', '<', now()->addDays(14))
                    ->orderBy('starts_at')->limit(80)->get()
                    ->map(fn (ClanShift $s) => [
                        'id' => $s->id, 'title' => $s->title,
                        'starts_at' => $s->starts_at->toIso8601String(), 'ends_at' => $s->ends_at->toIso8601String(),
                        'user' => $s->user?->toCard(), 'mine' => $s->user_id === $user->id,
                    ])->values()
                : [],
            'contributions' => $member && $clan->hasFeature('treasury')
                ? ClanContribution::query()->with('user')->where('clan_id', $clan->id)
                    ->when(! $can['treasury.manage'], fn (Builder $q) => $q->where(fn (Builder $w) => $w->where('status', ClanContribution::STATUS_APPROVED)->orWhere('user_id', $user->id)))
                    ->latest('id')->limit(40)->get()
                    ->map(fn (ClanContribution $c) => ['id' => $c->id, 'amount' => $c->amount, 'comment' => $c->comment, 'status' => $c->status, 'user' => $c->user?->toCard(), 'created_at' => $c->created_at->toIso8601String()])
                : [],
            'rating' => $member && $clan->hasFeature('rating') ? array_slice($this->clans->rating($clan), 0, 50) : [],
            'permissions' => $can['settings.manage'] ? ['labels' => Clan::PERMISSIONS, 'matrix' => $clan->permissionMatrix()] : null,
            'settings' => $can['settings.manage'] ? [
                'name' => $clan->name, 'tag' => $clan->tag, 'description' => $clan->description, 'rules' => $clan->rules,
                'join_mode' => $clan->join_mode, 'is_recruiting' => $clan->is_recruiting, 'currency' => $clan->currency,
                'questions' => array_values(array_filter((array) $clan->questions, 'is_string')),
            ] : null,
            'allies' => $this->allies($clan),
            // Персонал: кнопка «Видалити клан» прямо на сторінці (у журнал).
            'can_staff_delete' => $request->user()?->isAdmin() === true,
            'alliance_requests' => $request->user()?->id === $clan->owner_id
                ? ClanAlliance::query()->with('clan')->where('ally_id', $clan->id)->where('status', ClanAlliance::PENDING)->latest('id')->get()
                    ->map(fn (ClanAlliance $row) => ['id' => $row->id, 'name' => $row->clan->display_name, 'slug' => $row->clan->slug])->values()
                : [],
            'matches' => $this->matches($clan),
            'logs' => $can['settings.manage']
                ? ClanLog::query()->with('actor')->where('clan_id', $clan->id)->latest('id')->limit(30)->get()
                    ->map(fn (ClanLog $l) => ['id' => $l->id, 'text' => $l->text, 'actor' => $l->actor?->name, 'created_at' => $l->created_at->toIso8601String()])
                : [],
        ]);
    }

    public function join(Request $request, Clan $clan): RedirectResponse
    {
        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
            'nickname' => ['nullable', 'string', 'max:40'],
            'answers' => ['nullable', 'array', 'max:3'],
            'answers.*' => ['nullable', 'string', 'max:300'],
        ]);
        $member = $this->clans->join($clan, $this->user($request), $data['note'] ?? null, $data['nickname'] ?? null, $data['answers'] ?? null);

        return $this->done($member->status === ClanMember::STATUS_ACTIVE ? 'Ви в клані! 🎉' : 'Заявку надіслано — керівництво розгляне її.');
    }

    public function leave(Request $request, Clan $clan): RedirectResponse
    {
        $user = $this->user($request);
        $me = $this->clans->member($clan, $user);
        if ($me) {
            $this->clans->leave($clan, $me);
        } else {
            ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $user->id)->where('status', ClanMember::STATUS_PENDING)->update(['status' => ClanMember::STATUS_LEFT]);
        }

        return $this->done($me ? 'Ви вийшли з клану.' : 'Заявку відкликано.');
    }

    public function member(Request $request, Clan $clan, ClanMember $member): RedirectResponse
    {
        abort_unless($member->clan_id === $clan->id, 404);
        $actor = $this->me($request, $clan);
        $data = $request->validate([
            'action' => ['required', Rule::in(['accept', 'decline', 'kick', 'rank', 'transfer'])],
            'rank' => ['required_if:action,rank', 'integer', 'min:1', 'max:'.(Clan::LEADER_RANK - 1)],
        ]);

        match ($data['action']) {
            'accept' => $this->clans->accept($clan, $actor, $member),
            'decline' => $this->clans->decline($clan, $actor, $member),
            'kick' => $this->clans->kick($clan, $actor, $member),
            'rank' => $this->clans->setRank($clan, $actor, $member, (int) $data['rank']),
            default => $this->clans->transfer($clan, $actor, $member),
        };

        return $this->done('Збережено.');
    }

    /** Видалити клан чи гільдію: засновник або персонал сайту, з підтвердженням адресою. */
    public function destroy(Request $request, Clan $clan): RedirectResponse
    {
        $user = $request->user();
        abort_unless($clan->owner_id === $user->id || $user->isStaff(), 403);
        $request->validate(['confirm' => ['required', 'string']]);
        if ($request->input('confirm') !== $clan->slug) {
            throw ValidationException::withMessages(['confirm' => 'Введіть адресу, щоб підтвердити видалення.']);
        }

        $clan->delete();
        Log::info('clan: deleted', ['clan' => $clan->id, 'slug' => $clan->slug, 'type' => $clan->type, 'by' => $user->id, 'staff' => $clan->owner_id !== $user->id]);
        $kind = $clan->type === 'guild' ? 'Гільдію' : 'Клан';
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$kind} «{$clan->name}» видалено."]);

        return to_route('clans.index');
    }

    public function update(Request $request, Clan $clan): RedirectResponse
    {
        $actor = $this->me($request, $clan);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:60'],
            'tag' => ['sometimes', 'string', 'min:2', 'max:6', 'regex:/^[\pL\pN]+$/u'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'rules' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'join_mode' => ['sometimes', Rule::in(array_keys(Clan::JOIN_MODES))],
            'is_recruiting' => ['sometimes', 'boolean'],
            'currency' => ['sometimes', 'string', 'min:1', 'max:24'],
            'questions' => ['sometimes', 'array', 'max:3'],
            'questions.*' => ['nullable', 'string', 'max:80'],
            'features' => ['sometimes', 'array'],
            'features.*' => [Rule::in(array_keys(Clan::FEATURES))],
            'rank_titles' => ['sometimes', 'array'],
            'rank_titles.*' => ['nullable', 'string', 'max:24'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['array'],
            'permissions.*.*' => ['integer', 'between:1,4'],
            'settings' => ['sometimes', 'array'],
            'settings.mvp' => ['sometimes', 'boolean'],
            'settings.bracket' => ['sometimes', 'boolean'],
            'settings.nudge' => ['sometimes', 'boolean'],
            'settings.listen' => ['sometimes', 'boolean'],
            'settings.shifts_self_claim' => ['sometimes', 'boolean'],
            'settings.shifts_week_limit' => ['sometimes', 'integer', 'min:0', 'max:21'],
            'settings.shifts_remind' => ['sometimes', 'boolean'],
            'logo' => ['nullable', 'image', 'max:5120'],
        ], ['tag.regex' => 'Тег — лише літери й цифри без пробілів.']);

        $this->clans->update($clan, $actor, $data, $request->file('logo'));

        return $this->done('Налаштування збережено.');
    }

    public function news(Request $request, Clan $clan): RedirectResponse
    {
        $this->feature($clan, 'news');
        $data = $request->validate(['title' => ['required', 'string', 'max:120'], 'body' => ['required', 'string', 'max:5000'], 'is_pinned' => ['sometimes', 'boolean']]);
        $this->clans->postNews($clan, $this->me($request, $clan), trim($data['title']), trim($data['body']), (bool) ($data['is_pinned'] ?? false));

        return $this->done('Новину опубліковано.');
    }

    public function deleteNews(Request $request, Clan $clan, ClanNews $news): RedirectResponse
    {
        $this->clans->deleteNews($clan, $this->me($request, $clan), $news);

        return $this->done('Новину видалено.');
    }

    public function event(Request $request, Clan $clan): RedirectResponse
    {
        $this->feature($clan, 'events');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'starts_at' => ['required', 'date', 'after:now'],
            'weekly' => ['sometimes', 'boolean'],
            'cover' => ['nullable', 'image', 'max:5120'],
        ]);
        $cover = $request->file('cover');
        $this->clans->createEvent(
            $clan,
            $this->me($request, $clan),
            trim($data['title']),
            $data['description'] ?? null,
            Carbon::parse($data['starts_at'], 'Europe/Kyiv')->utc(),
            ($data['weekly'] ?? false) ? 'weekly' : null,
            $cover instanceof UploadedFile ? $cover : null,
        );

        return $this->done('Захід створено.');
    }

    public function rsvp(Request $request, Clan $clan, ClanEvent $event): RedirectResponse
    {
        $going = $this->clans->rsvp($clan, $this->me($request, $clan), $event);

        return $this->done($going ? 'Ви йдете ✅' : 'Відмітку знято.');
    }

    public function deleteEvent(Request $request, Clan $clan, ClanEvent $event): RedirectResponse
    {
        $this->clans->deleteEvent($clan, $this->me($request, $clan), $event);

        return $this->done('Захід видалено.');
    }

    /** Нова зміна (можна одразу на кілька тижнів поспіль). */
    public function shift(Request $request, Clan $clan): RedirectResponse
    {
        $this->feature($clan, 'shifts');
        $actor = $this->clans->authorize($this->me($request, $clan), $clan, 'shifts.manage');
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:80'],
            'starts_at' => ['required', 'date'],
            'hours' => ['required', 'numeric', 'min:0.5', 'max:24'],
            'user_id' => ['nullable', 'integer'],
            'repeat_weeks' => ['nullable', 'integer', 'min:1', 'max:8'],
        ]);
        $userId = $this->shiftUser($clan, $data['user_id'] ?? null);
        $start = Carbon::parse($data['starts_at'], 'Europe/Kyiv')->utc();
        $minutes = (int) round((float) $data['hours'] * 60);
        for ($w = 0; $w < (int) ($data['repeat_weeks'] ?? 1); $w++) {
            $from = $start->copy()->addWeeks($w);
            ClanShift::query()->create([
                'clan_id' => $clan->id, 'title' => trim($data['title']), 'starts_at' => $from,
                'ends_at' => $from->copy()->addMinutes($minutes), 'user_id' => $userId, 'created_by' => $actor->user_id,
            ]);
        }
        $this->clans->log($clan, $actor->user, 'shift', 'Зміна «'.trim($data['title']).'»');

        return $this->done('Зміну додано.');
    }

    /** Взяти вільну зміну, віддати свою або (з правом на заходи) призначити/видалити. */
    public function shiftAction(Request $request, Clan $clan, ClanShift $shift): RedirectResponse
    {
        $this->feature($clan, 'shifts');
        abort_unless($shift->clan_id === $clan->id, 404);
        $me = $this->me($request, $clan);
        $data = $request->validate(['action' => ['required', Rule::in(['claim', 'release', 'assign', 'delete'])], 'user_id' => ['nullable', 'integer']]);
        switch ($data['action']) {
            case 'claim':
                abort_unless($shift->user_id === null && $shift->ends_at->isFuture(), 422, 'Цю зміну вже взяли.');
                abort_unless($clan->setting('shifts_self_claim') || $this->clans->can($me, $clan, 'shifts.manage'), 403, 'Зміни в цьому клані призначає керівництво.');
                $limit = (int) $clan->setting('shifts_week_limit');
                if ($limit > 0) {
                    $from = $shift->starts_at->copy()->timezone('Europe/Kyiv')->startOfWeek()->utc();
                    $taken = ClanShift::query()->where('clan_id', $clan->id)->where('user_id', $me->user_id)
                        ->where('starts_at', '>=', $from)->where('starts_at', '<', $from->copy()->addWeek())->count();
                    abort_if($taken >= $limit, 422, "Ліміт клану — {$limit} змін на тиждень.");
                }
                $shift->update(['user_id' => $me->user_id]);
                $message = 'Зміну взято.';
                break;
            case 'release':
                abort_unless($shift->user_id === $me->user_id && $shift->starts_at->isFuture(), 403);
                $shift->update(['user_id' => null]);
                $message = 'Зміну віддано — вона знову вільна.';
                break;
            case 'assign':
                $this->clans->authorize($me, $clan, 'shifts.manage');
                $shift->update(['user_id' => $this->shiftUser($clan, $data['user_id'] ?? null)]);
                $message = 'Призначено.';
                break;
            default:
                $this->clans->authorize($me, $clan, 'shifts.manage');
                $shift->delete();
                $message = 'Зміну видалено.';
        }
        $this->clans->log($clan, $me->user, 'shift_'.$data['action'], 'Зміна «'.$shift->title.'»');

        return $this->done($message);
    }

    public function bracket(Request $request, Clan $clan, ClanEvent $event): RedirectResponse
    {
        $this->feature($clan, 'events');
        abort_unless((bool) $clan->setting('bracket'), 404, 'Турнірну сітку вимкнено в налаштуваннях клану.');
        $data = $request->validate([
            'teams' => ['required', 'array', 'size:4'],
            'teams.*' => ['required', 'string', 'max:40'],
            'semi' => ['required', 'array', 'size:2'],
            'semi.*' => ['array', 'size:2'],
            'semi.*.*' => ['nullable', 'integer', 'min:0', 'max:99'],
            'final' => ['required', 'array', 'size:2'],
            'final.*' => ['nullable', 'integer', 'min:0', 'max:99'],
        ]);
        $score = function (mixed $value): ?int {
            return $value === null || $value === '' ? null : (int) $value;
        };
        $this->clans->saveBracket($clan, $this->me($request, $clan), $event, [
            'teams' => array_values(array_map(fn ($name) => trim((string) $name), $data['teams'])),
            'semi' => [
                [$score($data['semi'][0][0] ?? null), $score($data['semi'][0][1] ?? null)],
                [$score($data['semi'][1][0] ?? null), $score($data['semi'][1][1] ?? null)],
            ],
            'final' => [$score($data['final'][0] ?? null), $score($data['final'][1] ?? null)],
        ]);

        return $this->done('Сітку збережено.');
    }

    /** Жива сітка заходу: учасники клану опитують її, поки йде турнір. */
    public function bracketState(Request $request, Clan $clan, ClanEvent $event): JsonResponse
    {
        $this->feature($clan, 'events');
        $this->me($request, $clan);
        abort_unless($event->clan_id === $clan->id, 404);

        return response()->json(['bracket' => $event->bracket, 'updated_at' => $event->updated_at?->toIso8601String()]);
    }

    public function contribute(Request $request, Clan $clan): RedirectResponse
    {
        $this->feature($clan, 'treasury');
        $data = $request->validate(['amount' => ['required', 'integer', 'min:1', 'max:1000000000'], 'comment' => ['nullable', 'string', 'max:200']]);
        $this->clans->contribute($clan, $this->me($request, $clan), (int) $data['amount'], $data['comment'] ?? null);

        return $this->done('Внесок записано — скарбник підтвердить його.');
    }

    public function review(Request $request, Clan $clan, ClanContribution $contribution): RedirectResponse
    {
        $data = $request->validate(['approve' => ['required', 'boolean']]);
        $this->clans->review($clan, $this->me($request, $clan), $contribution, (bool) $data['approve']);

        return $this->done($data['approve'] ? 'Внесок підтверджено.' : 'Внесок відхилено.');
    }

    public function spend(Request $request, Clan $clan): RedirectResponse
    {
        $this->feature($clan, 'treasury');
        $data = $request->validate(['amount' => ['required', 'integer', 'min:1', 'max:1000000000'], 'comment' => ['required', 'string', 'max:200']]);
        $this->clans->spend($clan, $this->me($request, $clan), (int) $data['amount'], trim($data['comment']));

        return $this->done('Витрату записано.');
    }

    public function ally(Request $request, Clan $clan): RedirectResponse
    {
        abort_unless($request->user()?->id === $clan->owner_id, 403);
        $data = $request->validate(['tag' => ['required', 'string', 'max:6']]);
        $other = Clan::query()->where('tag', strtoupper(trim($data['tag'])))->whereKeyNot($clan->id)->first();
        abort_unless($other instanceof Clan, 422);
        $exists = ClanAlliance::query()
            ->where(fn ($q) => $q->where('clan_id', $clan->id)->where('ally_id', $other->id))
            ->orWhere(fn ($q) => $q->where('clan_id', $other->id)->where('ally_id', $clan->id))
            ->exists();
        abort_if($exists, 422);
        ClanAlliance::query()->create(['clan_id' => $clan->id, 'ally_id' => $other->id, 'status' => ClanAlliance::PENDING]);

        return $this->done('Пропозицію союзу надіслано.');
    }

    public function acceptAlly(Request $request, Clan $clan, ClanAlliance $alliance): RedirectResponse
    {
        abort_unless($request->user()?->id === $clan->owner_id, 403);
        abort_unless($alliance->ally_id === $clan->id && $alliance->status === ClanAlliance::PENDING, 404);
        $alliance->update(['status' => ClanAlliance::ACCEPTED]);

        return $this->done('Союз прийнято.');
    }

    public function match(Request $request, Clan $clan): RedirectResponse
    {
        abort_unless($request->user()?->id === $clan->owner_id, 403);
        $data = $request->validate([
            'tag' => ['required', 'string', 'max:6'],
            'starts_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:200'],
        ]);
        $other = Clan::query()->where('tag', strtoupper(trim($data['tag'])))->whereKeyNot($clan->id)->first();
        abort_unless($other instanceof Clan, 422);
        ClanMatch::query()->create([
            'clan_id' => $clan->id,
            'opponent_id' => $other->id,
            'starts_at' => Carbon::parse($data['starts_at']),
            'note' => trim((string) ($data['note'] ?? '')) ?: null,
        ]);

        return $this->done('Матч призначено.');
    }

    public function chat(Request $request, Clan $clan): RedirectResponse
    {
        $this->me($request, $clan);
        $this->feature($clan, 'chat');
        $conversation = $this->clans->syncChat($clan);
        abort_unless($conversation !== null, 404);

        return to_route('messages.show', $conversation);
    }

    /**
     * @return list<array{name: string, slug: string}>
     */
    private function allies(Clan $clan): array
    {
        return array_values(ClanAlliance::query()->with(['clan', 'ally'])->where('status', ClanAlliance::ACCEPTED)
            ->where(fn ($q) => $q->where('clan_id', $clan->id)->orWhere('ally_id', $clan->id))
            ->latest('id')->get()
            ->map(function (ClanAlliance $row) use ($clan) {
                $other = $row->clan_id === $clan->id ? $row->ally : $row->clan;

                return ['name' => $other->display_name, 'slug' => $other->slug];
            })->all());
    }

    /**
     * @return list<array{id: int, home: string, away: string, starts_at: string, note: string|null}>
     */
    private function matches(Clan $clan): array
    {
        return array_values(ClanMatch::query()->with(['clan', 'opponent'])
            ->where(fn ($q) => $q->where('clan_id', $clan->id)->orWhere('opponent_id', $clan->id))
            ->orderBy('starts_at')->limit(12)->get()
            ->map(fn (ClanMatch $row) => [
                'id' => $row->id,
                'home' => $row->clan->tag,
                'away' => $row->opponent->tag,
                'starts_at' => $row->starts_at->toIso8601String(),
                'note' => $row->note,
            ])->all());
    }

    /** Нагадати учасникові, що давно не заходив. */
    public function nudge(Request $request, Clan $clan, ClanMember $member): RedirectResponse
    {
        abort_unless($member->clan_id === $clan->id && $member->status === ClanMember::STATUS_ACTIVE, 404);
        abort_unless((bool) $clan->setting('nudge'), 404, 'Нагадування вимкнено в налаштуваннях клану.');
        $actor = $this->clans->authorize($this->me($request, $clan), $clan, 'members.manage');
        $target = User::query()->findOrFail($member->user_id);
        if (! ComeBackNudge::allowed($target, 'clan.'.$clan->id)) {
            throw ValidationException::withMessages(['member' => 'Нагадати можна тому, хто не заходив 2 тижні, і не частіше разу на 3 дні.']);
        }
        $target->notify(new ComeBackNudge(User::query()->findOrFail($actor->user_id), $clan->display_name, '/clans/'.$clan->slug));

        return $this->done('Нагадування надіслано.');
    }

    private function shiftUser(Clan $clan, ?int $userId): ?int
    {
        if ($userId === null) {
            return null;
        }
        abort_unless($clan->activeMembers()->where('user_id', $userId)->exists(), 422, 'Цієї людини немає в клані.');

        return $userId;
    }

    private function feature(Clan $clan, string $feature): void
    {
        abort_unless($clan->hasFeature($feature), 404, 'Цей розділ у клані вимкнено.');
    }

    private function me(Request $request, Clan $clan): ClanMember
    {
        $member = $this->clans->member($clan, $this->user($request));
        abort_unless($member !== null, 403, 'Розділ доступний лише учасникам клану.');

        return $member;
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
