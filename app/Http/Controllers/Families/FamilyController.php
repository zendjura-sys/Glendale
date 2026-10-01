<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyAuditLog;
use App\Models\FamilyEvent;
use App\Models\FamilyItem;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Models\FamilyReport;
use App\Models\FamilyTransaction;
use App\Models\GtaServer;
use App\Services\Families\FamilyRating;
use App\Services\Families\FamilyService;
use App\Services\Families\WeeklyDigest;
use App\Services\ImageStorage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilyController extends FamilyBaseController
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $filters = $request->validate([
            'server' => ['nullable', 'string', 'max:80'],
            'q' => ['nullable', 'string', 'max:60'],
        ]);

        $mine = FamilyMember::query()
            ->with('family.server')
            ->where('user_id', $user->id)
            ->whereIn('status', [FamilyMember::STATUS_ACTIVE, FamilyMember::STATUS_PENDING])
            ->whereHas('family')
            ->latest('updated_at')
            ->get()
            ->map(fn (FamilyMember $m) => [
                ...$m->family->toCard(),
                'membership' => [
                    'status' => $m->status,
                    'display' => $m->displayName(),
                    'rank' => $m->rank,
                    'rank_title' => $m->family->rankTitle($m->rank),
                    'balance' => $m->isActive() ? $m->balance : null,
                ],
            ]);

        $server = isset($filters['server']) ? GtaServer::query()->where('slug', $filters['server'])->first() : null;
        $discover = Family::query()
            ->with('server')
            ->where('status', Family::STATUS_VERIFIED)
            ->when($server, fn (Builder $q, GtaServer $s) => $q->where('server_id', $s->id))
            ->when($filters['q'] ?? null, fn (Builder $q, string $t) => $q->where(fn (Builder $q) => $q->where('name', 'like', "%{$t}%")->orWhere('tag', 'like', "%{$t}%")))
            ->orderByDesc('members_count')
            ->orderByDesc('id')
            ->paginate(24)
            ->withQueryString()
            ->through(fn (Family $f) => [...$f->toCard(), 'description' => $f->description]);

        return Inertia::render('families/index', [
            'mine' => $mine,
            'families' => $discover,
            'filters' => ['server' => $server?->slug, 'q' => $filters['q'] ?? ''],
            'servers' => $this->servers(),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('families/create', [
            'servers' => $this->servers(),
            'server' => $request->string('server')->toString() ?: null,
        ]);
    }

    public function store(Request $request, FamilyService $families, ImageStorage $images): RedirectResponse
    {
        $request->merge(['tag' => Str::upper(trim($request->string('tag')->toString()))]);
        $data = $request->validate([
            'server_id' => ['required', 'integer', Rule::exists('gta_servers', 'id')->where('status', GtaServer::STATUS_PUBLISHED)->whereNull('deleted_at')],
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'tag' => ['required', 'string', 'min:2', 'max:8', 'regex:/^[A-Za-z0-9А-Яа-яІіЇїЄєҐґ]+$/u', Rule::unique('families', 'tag')->where('server_id', $request->integer('server_id'))],
            'description' => ['nullable', 'string', 'max:2000'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            ...self::nicknameRules(),
        ], [
            ...self::nicknameMessages(),
            'tag.unique' => 'Сім’я з таким тегом уже є на цьому сервері.',
            'tag.regex' => 'Тег — лише літери та цифри без пробілів.',
        ]);

        abort_if(
            Family::query()->where('owner_id', $request->user()->id)->where('status', Family::STATUS_PENDING)->count() >= 2,
            429,
            'У вас уже 2 сім’ї на верифікації.',
        );

        $family = $families->create($request->user(), $data);
        if ($request->hasFile('logo')) {
            $family->forceFill(['logo_path' => $images->store($request->file('logo'), 'families/logos', cover: [512, 512])['path']])->save();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "Сім’ю [{$family->tag}] {$family->name} створено! Після верифікації відкриються набір і чат."]);

        return to_route('families.show', $family);
    }

    public function show(Request $request, Family $family, FamilyRating $rating, WeeklyDigest $digest): Response
    {
        $member = $this->gate->member($family, $request->user());
        if (! $member) {
            return $this->publicPage($request, $family);
        }

        $can = $this->gate->abilities($member, $family);
        $week = $digest->build($family);

        return $this->page($family, $member, 'families/overview', 'overview', [
            'stats' => [
                'week_earned' => (int) (collect($week['lines'])->firstWhere('member.id', $member->id)['total'] ?? 0),
                'week_total' => $week['total'],
                'pending_reports' => FamilyReport::query()->where('beneficiary_id', $member->id)->where('status', FamilyReport::STATUS_PENDING)->count(),
                'warns' => FamilyPunishment::query()->active()->where('member_id', $member->id)->where('type', FamilyPunishment::TYPE_WARN)->count(),
                'warn_limit' => (int) $family->setting('discipline.warn_limit', 3),
            ],
            'leaders' => array_slice($rating->leaderboard($family, 'week'), 0, 5),
            'events' => FamilyEvent::query()->where('family_id', $family->id)
                ->where('status', FamilyEvent::STATUS_PLANNED)
                ->where('starts_at', '>=', now()->subHours(3))
                ->orderBy('starts_at')->limit(3)->get()
                ->map(fn (FamilyEvent $e) => ['id' => $e->id, 'title' => $e->title, 'type' => $e->type, 'type_label' => FamilyEvent::TYPES[$e->type], 'starts_at' => $e->starts_at->toIso8601String()]),
            'transactions' => FamilyTransaction::query()->where('member_id', $member->id)->latest('id')->limit(6)->get()
                ->map(fn (FamilyTransaction $t) => FamilyBankController::transaction($t)),
            'low_stock' => FamilyItem::query()->where('family_id', $family->id)->where('is_archived', false)
                ->whereNotNull('min_stock')->whereColumn('quantity', '<=', 'min_stock')->limit(6)->get()
                ->map(fn (FamilyItem $i) => $i->toCard()),
            'activity' => $can['audit.view']
                ? FamilyAuditLog::query()->with(['actor', 'target'])->where('family_id', $family->id)->latest('id')->limit(8)->get()
                    ->map(fn (FamilyAuditLog $l) => FamilyAuditController::entry($l))
                : [],
        ]);
    }

    public function apply(Request $request, Family $family, FamilyService $families): RedirectResponse
    {
        $data = $request->validate([
            ...self::nicknameRules(),
            'note' => ['nullable', 'string', 'max:1000'],
        ], self::nicknameMessages());

        $families->apply($family, $request->user(), $data);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку надіслано! Офіцери сім’ї розглянуть її найближчим часом.']);

        return back();
    }

    public function withdraw(Request $request, Family $family): RedirectResponse
    {
        FamilyMember::query()->where('family_id', $family->id)->where('user_id', $request->user()->id)
            ->where('status', FamilyMember::STATUS_PENDING)
            ->update(['status' => FamilyMember::STATUS_LEFT, 'left_at' => now()]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку відкликано.']);

        return back();
    }

    public function leave(Request $request, Family $family, FamilyService $families): RedirectResponse
    {
        $member = $this->member($request, $family);
        $families->leave($family, $member);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ви покинули сім’ю.']);

        return to_route('families.index');
    }

    public function chat(Request $request, Family $family): RedirectResponse
    {
        $this->member($request, $family);
        abort_unless($family->conversation_id, 404, 'Чат з’явиться після верифікації сім’ї.');

        return redirect()->route('messages.show', $family->conversation_id);
    }

    private function publicPage(Request $request, Family $family): Response
    {
        $family->load('server');
        $application = FamilyMember::query()->where('family_id', $family->id)->where('user_id', $request->user()->id)->first();
        abort_if(! $family->isVerified() && ! $request->user()->isAdmin() && $application === null, 404);

        $leaders = FamilyMember::query()->with('user')->where('family_id', $family->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->where('rank', '>=', 8)->orderByDesc('rank')->limit(6)->get()
            ->map(fn (FamilyMember $m) => $m->toCard($family));

        return Inertia::render('families/public', [
            'family' => [...$family->toCard(), 'description' => $family->description, 'created_at' => $family->created_at->toIso8601String()],
            'leaders' => $leaders,
            'application' => $application ? [
                'status' => $application->status,
                'display' => $application->displayName(),
                'left_at' => $application->left_at?->toIso8601String(),
            ] : null,
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function servers(): array
    {
        return GtaServer::query()->published()->orderByDesc('is_featured')->orderBy('name')->get()
            ->map(fn (GtaServer $s) => ['id' => $s->id, 'slug' => $s->slug, 'name' => $s->name, 'icon' => $s->icon, 'platform' => $s->platform])
            ->all();
    }
}
