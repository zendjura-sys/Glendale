<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Families\FamilyAuditController;
use App\Http\Controllers\Families\FamilyBankController;
use App\Http\Controllers\Families\FamilyBaseController;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Family;
use App\Models\FamilyAuditLog;
use App\Models\FamilyCashout;
use App\Models\FamilyDeposit;
use App\Models\FamilyEvent;
use App\Models\FamilyItem;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Models\FamilyReport;
use App\Models\FamilyReportProof;
use App\Models\FamilyTransaction;
use App\Models\GtaServer;
use App\Models\Post;
use App\Services\CommunityService;
use App\Services\Families\Discipline;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyBank;
use App\Services\Families\FamilyGate;
use App\Services\Families\FamilyRating;
use App\Services\Families\FamilyService;
use App\Services\Families\MemberStats;
use App\Services\Families\ReportService;
use App\Services\Families\WeeklyDigest;
use App\Services\PostPresenter;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GroupsApiController extends ApiController
{
    public function __construct(
        private readonly CommunityService $communities,
        private readonly PostPresenter $presenter,
        private readonly FamilyGate $gate,
    ) {}

    public function communities(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $joined = $this->communities->joinedIds($user);
        $managed = $this->communities->managedIds($user);
        $tab = in_array($request->query('tab'), ['mine', 'managed', 'discover'], true)
            ? (string) $request->query('tab')
            : ($joined === [] ? 'discover' : 'mine');
        $term = trim((string) $request->query('q', ''));

        $query = Community::query()
            ->when($tab === 'mine', fn (Builder $q) => $q->whereIn('id', $joined !== [] ? $joined : [0]))
            ->when($tab === 'managed', fn (Builder $q) => $q->whereIn('id', $managed !== [] ? $managed : [0]))
            ->when($term !== '', fn (Builder $q) => $q->search($term))
            ->orderByDesc('is_verified')
            ->orderByDesc('members_count');

        $statuses = CommunityMember::query()->where('user_id', $user->id)->pluck('status', 'community_id');
        $page = $query->paginate(24);

        return response()->json([
            'tab' => $tab,
            'categories' => Community::CATEGORIES,
            'counts' => ['mine' => count($joined), 'managed' => count($managed)],
            'communities' => $this->page($page, $page->getCollection()->map(fn (Community $c) => [
                ...$c->toCard(),
                'membership' => $statuses[$c->id] ?? null,
                'managed' => in_array($c->id, $managed, true),
            ])->values()->all()),
        ]);
    }

    public function storeCommunity(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:100'],
            'type' => ['required', Rule::in(Community::TYPES)],
            'category' => ['required', Rule::in(array_keys(Community::CATEGORIES))],
            'privacy' => ['required', Rule::in(Community::PRIVACIES)],
        ]);

        $community = $this->communities->create($this->user($request), $data);

        return response()->json(['community' => $community->toCard()], 201);
    }

    public function community(Request $request, Community $community): JsonResponse
    {
        $user = $this->user($request);
        $membership = $community->membershipFor($user);
        $posts = Post::query()
            ->where('wall_type', $community->getMorphClass())
            ->where('wall_id', $community->id)
            ->visibleTo($user, [])
            ->orderByDesc('is_pinned')
            ->orderByDesc('id')
            ->paginate(10);

        return response()->json([
            'community' => [
                ...$community->toCard(),
                'description' => $community->description,
                'membership' => $membership?->status,
                'managed' => $membership?->isManager() ?? false,
            ],
            'posts' => $this->page($posts, $this->presenter->many(new Collection($posts->items()), $user)),
        ]);
    }

    public function joinCommunity(Request $request, Community $community): JsonResponse
    {
        $status = $this->communities->join($community, $this->user($request));

        return response()->json(['membership' => $status]);
    }

    public function leaveCommunity(Request $request, Community $community): JsonResponse
    {
        $this->communities->leave($community, $this->user($request));

        return response()->json(['membership' => null]);
    }

    /**
     * Віджет на головному екрані телефона: особиста статистика в кожній сім’ї, де людина активна.
     */
    public function familyWidget(Request $request, MemberStats $stats): JsonResponse
    {
        $user = $this->user($request);
        $families = FamilyMember::query()->with('family')
            ->where('user_id', $user->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->whereHas('family')
            ->latest('updated_at')
            ->get()
            ->map(fn (FamilyMember $m) => $stats->widget($m->family, $m))
            ->values();

        return response()->json(['families' => $families]);
    }

    public function families(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $q = trim((string) $request->query('q', ''));

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
                ],
            ])->values();

        $discover = Family::query()
            ->with('server')
            ->where('status', Family::STATUS_VERIFIED)
            ->when($q !== '', fn (Builder $query) => $query->where(fn (Builder $w) => $w->where('name', 'like', "%{$q}%")->orWhere('tag', 'like', "%{$q}%")))
            ->orderByDesc('members_count')
            ->paginate(24);

        return response()->json([
            'mine' => $mine,
            'families' => $this->page($discover, $discover->getCollection()->map(fn (Family $f) => [
                ...$f->toCard(),
                'description' => $f->description,
            ])->values()->all()),
        ]);
    }

    public function family(Request $request, Family $family, FamilyRating $rating, WeeklyDigest $digest): JsonResponse
    {
        $user = $this->user($request);
        $member = $this->gate->member($family, $user);
        $family->load('server');

        if (! $member || ! $member->isActive()) {
            abort_if(! $family->isVerified() && ! $user->isAdmin() && $member === null, 404);

            return response()->json([
                'family' => [...$family->toCard(), 'description' => $family->description],
                'member' => $member ? ['status' => $member->status, 'display' => $member->displayName()] : null,
                'leaders' => FamilyMember::query()->with('user')->where('family_id', $family->id)
                    ->where('status', FamilyMember::STATUS_ACTIVE)->where('rank', '>=', 8)->orderByDesc('rank')->limit(6)->get()
                    ->map(fn (FamilyMember $m) => $m->toCard($family))->values(),
            ]);
        }

        $can = $this->gate->abilities($member, $family);
        $week = $digest->build($family);
        $settings = $family->resolvedSettings();
        $warns = FamilyPunishment::query()->active()->where('member_id', $member->id)->where('type', FamilyPunishment::TYPE_WARN)->count();

        return response()->json([
            'family' => [
                ...$family->toCard(),
                'description' => $family->description,
                'treasury' => $family->treasury,
                'rank_titles' => $family->rankTitles(),
            ],
            'member' => [
                ...$member->toCard($family),
                'balance' => $member->balance,
                'joined_at' => $member->joined_at?->toIso8601String(),
                'warns' => $warns,
                'warn_limit' => (int) $settings['discipline']['warn_limit'],
            ],
            'abilities' => $can,
            'chat_id' => $family->conversation_id,
            'overview' => [
                'stats' => [
                    'week_earned' => (int) (collect($week['lines'])->firstWhere('member.id', $member->id)['total'] ?? 0),
                    'week_total' => $week['total'],
                    'pending_reports' => FamilyReport::query()->where('beneficiary_id', $member->id)->where('status', FamilyReport::STATUS_PENDING)->count(),
                    'warns' => $warns,
                    'warn_limit' => (int) $settings['discipline']['warn_limit'],
                ],
                'leaders' => array_values(array_filter(array_slice($rating->leaderboard($family, 'week'), 0, 5), fn (array $row) => ($row['points'] ?? 0) > 0)),
                'events' => FamilyEvent::query()->where('family_id', $family->id)
                    ->where('status', FamilyEvent::STATUS_PLANNED)
                    ->where('starts_at', '>=', now()->subHours(3))
                    ->orderBy('starts_at')->limit(3)->get()
                    ->map(fn (FamilyEvent $e) => [
                        'id' => $e->id,
                        'title' => $e->title,
                        'type_label' => FamilyEvent::TYPES[$e->type] ?? $e->type,
                        'starts_at' => $e->starts_at->toIso8601String(),
                    ])->values(),
                'transactions' => FamilyTransaction::query()->where('member_id', $member->id)->latest('id')->limit(6)->get()
                    ->map(fn (FamilyTransaction $t) => FamilyBankController::transaction($t))->values(),
                'rates' => $settings['rates'],
                'deadline_hours' => (int) $settings['reports']['deadline_hours'],
                'contract_limit' => (int) $settings['reports']['contract_daily_limit'],
                'max_proofs' => (int) $settings['reports']['max_proofs'],
                'cashout_min' => $settings['cashout']['min_amount'],
                'deposits' => $settings['deposits'],
            ],
        ]);
    }

    public function applyFamily(Request $request, Family $family, FamilyService $families): JsonResponse
    {
        $data = $request->validate([
            ...FamilyBaseController::nicknameRules(),
            'note' => ['nullable', 'string', 'max:1000'],
        ], FamilyBaseController::nicknameMessages());

        $families->apply($family, $this->user($request), $data);

        return response()->json(['ok' => true]);
    }

    public function members(Request $request, Family $family): JsonResponse
    {
        $actor = $this->active($request, $family);
        $can = $this->gate->abilities($actor, $family);
        $members = FamilyMember::query()->with('user')->where('family_id', $family->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)->orderByDesc('rank')->get()
            ->map(fn (FamilyMember $m) => [
                ...$m->toCard($family),
                'balance' => $m->balance,
                'joined_at' => $m->joined_at?->toIso8601String(),
            ])->values();
        $applications = $can['members.manage']
            ? FamilyMember::query()->with('user')->where('family_id', $family->id)->where('status', FamilyMember::STATUS_PENDING)->latest('id')->get()
                ->map(fn (FamilyMember $m) => [...$m->toCard($family), 'note' => $m->application_note])->values()
            : [];

        return response()->json([
            'members' => $members,
            'applications' => $applications,
            'ranks' => [
                'titles' => $family->rankTitles(),
                'matrix' => $family->permissionMatrix(),
                'permissions' => Family::PERMISSIONS,
                'can_edit' => $can['ranks.manage'],
            ],
        ]);
    }

    public function bank(Request $request, Family $family): JsonResponse
    {
        $member = $this->active($request, $family);
        $can = $this->gate->abilities($member, $family);
        $scope = $can['treasury.manage'] && $request->query('scope') === 'family' ? 'family' : 'me';
        $settings = $family->resolvedSettings();
        $rows = FamilyTransaction::query()->with(['member', 'actor'])->where('family_id', $family->id)
            ->when($scope === 'me', fn (Builder $q) => $q->where('member_id', $member->id))
            ->latest('id')->limit(40)->get()
            ->map(fn (FamilyTransaction $t) => FamilyBankController::transaction($t, $family))->values();

        return response()->json([
            'scope' => $scope,
            'balance' => $member->balance,
            'treasury' => $family->treasury,
            'transactions' => $rows,
            'config' => [
                'deposits' => $settings['deposits'],
                'cashout_min' => $settings['cashout']['min_amount'],
            ],
            'totals' => $can['treasury.manage'] ? [
                'balances' => (int) FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->sum('balance'),
                'deposits' => (int) FamilyDeposit::query()->where('family_id', $family->id)->where('status', FamilyDeposit::STATUS_ACTIVE)->sum('amount'),
                'pending_cashouts' => (int) FamilyCashout::query()->where('family_id', $family->id)->where('status', FamilyCashout::STATUS_PENDING)->sum('amount'),
                'paid_week' => (int) -FamilyTransaction::query()->where('family_id', $family->id)->where('type', 'cashout_paid')->where('created_at', '>=', now()->subWeek())->sum('treasury_delta'),
            ] : [
                'balances' => $member->balance,
                'deposits' => (int) FamilyDeposit::query()->where('member_id', $member->id)->where('status', FamilyDeposit::STATUS_ACTIVE)->sum('amount'),
                'pending_cashouts' => (int) FamilyCashout::query()->where('member_id', $member->id)->where('status', FamilyCashout::STATUS_PENDING)->sum('amount'),
                'paid_week' => 0,
            ],
            'roster' => $can['treasury.manage']
                ? FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->orderByDesc('rank')->get()
                    ->map(fn (FamilyMember $m) => ['id' => $m->id, 'display' => $m->displayName()])->values()
                : [],
            'cashouts' => $can['treasury.manage']
                ? FamilyCashout::query()->with('member')->where('family_id', $family->id)->where('status', FamilyCashout::STATUS_PENDING)->orderBy('id')->get()
                    ->map(fn (FamilyCashout $c) => FamilyBankController::cashout($c))->values()
                : [],
        ]);
    }

    public function requestCashout(Request $request, Family $family, FamilyBank $bank): JsonResponse
    {
        $this->writable($family);
        $member = $this->active($request, $family);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:100000000'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);
        $bank->requestCashout($family, $member, Money::toMinor($data['amount']), $data['note'] ?? null);

        return response()->json(['ok' => true], 201);
    }

    public function openDeposit(Request $request, Family $family, FamilyBank $bank): JsonResponse
    {
        $this->writable($family);
        $member = $this->active($request, $family);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:100000000'],
            'period' => ['required', Rule::in(array_keys(FamilyDeposit::PERIODS))],
            'periods' => ['required', 'integer', 'min:1', 'max:60'],
        ]);
        $bank->openDeposit($family, $member, Money::toMinor($data['amount']), $data['period'], (int) $data['periods']);

        return response()->json(['ok' => true], 201);
    }

    public function manualBank(Request $request, Family $family, FamilyBank $bank): JsonResponse
    {
        $this->writable($family);
        $member = $this->active($request, $family);
        $this->gate->authorize($member, $family, 'treasury.manage');
        $data = $request->validate([
            'target' => ['required', Rule::in(['member', 'treasury'])],
            'member_id' => ['nullable', 'required_if:target,member', 'integer'],
            'direction' => ['required', Rule::in(['credit', 'debit'])],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:100000000'],
            'comment' => ['required', 'string', 'min:3', 'max:300'],
        ]);
        $amount = Money::toMinor($data['amount']) * ($data['direction'] === 'debit' ? -1 : 1);
        if ($data['target'] === 'treasury') {
            $bank->treasury($family, $member, $amount, $data['comment']);
        } else {
            $target = FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->findOrFail($request->integer('member_id'));
            $bank->manual($family, $member, $target, $amount, $data['comment']);
        }

        return response()->json(['ok' => true]);
    }

    public function discipline(Request $request, Family $family): JsonResponse
    {
        $member = $this->active($request, $family);
        $can = $this->gate->abilities($member, $family);
        $scope = $can['sanctions.issue'] && $request->query('scope') === 'me' ? 'me' : ($can['sanctions.issue'] ? 'family' : 'me');
        $settings = $family->resolvedSettings()['discipline'];
        $list = FamilyPunishment::query()->with(['member', 'issuer'])->where('family_id', $family->id)
            ->when($scope === 'me', fn (Builder $q) => $q->where('member_id', $member->id))
            ->latest('id')->limit(80)->get()
            ->map(fn (FamilyPunishment $p) => [
                'id' => $p->id,
                'type' => $p->type,
                'type_label' => FamilyPunishment::TYPES[$p->type] ?? $p->type,
                'reason' => $p->reason,
                'amount' => $p->amount,
                'member' => $p->member->displayName(),
                'issuer' => $p->is_auto ? 'Система' : $p->issuer?->displayName(),
                'created_at' => $p->created_at->toIso8601String(),
            ])->values();
        $myWarns = FamilyPunishment::query()->active()->where('member_id', $member->id)->where('type', FamilyPunishment::TYPE_WARN)->count();

        return response()->json([
            'scope' => $scope,
            'punishments' => $list,
            'config' => $settings,
            'my_warns' => $myWarns,
            'can_issue' => $can['sanctions.issue'],
            'roster' => $can['sanctions.issue']
                ? FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->orderByDesc('rank')->get()
                    ->filter(fn (FamilyMember $m) => $member->outranks($m, $family))
                    ->map(fn (FamilyMember $m) => ['id' => $m->id, 'display' => $m->displayName()])->values()
                : [],
            'types' => FamilyPunishment::TYPES,
            'mute_hours' => FamilyPunishment::MUTE_HOURS,
        ]);
    }

    public function issuePunishment(Request $request, Family $family, Discipline $discipline): JsonResponse
    {
        $this->writable($family);
        $issuer = $this->active($request, $family);
        $this->gate->authorize($issuer, $family, 'sanctions.issue');
        $data = $request->validate([
            'member_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(array_keys(FamilyPunishment::TYPES))],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'amount' => ['nullable', 'required_if:type,fine', 'numeric', 'min:1', 'max:10000000'],
            'hours' => ['nullable', 'required_if:type,mute', 'integer', Rule::in(FamilyPunishment::MUTE_HOURS)],
        ]);
        $target = FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->findOrFail($request->integer('member_id'));
        $discipline->issue($family, $issuer, $target, $data['type'], $data['reason'], isset($data['amount']) ? Money::toMinor($data['amount']) : null, isset($data['hours']) ? (int) $data['hours'] : null);

        return response()->json(['ok' => true], 201);
    }

    public function rating(Request $request, Family $family, FamilyRating $rating): JsonResponse
    {
        $this->active($request, $family);
        $period = in_array($request->query('period'), ['week', 'month', 'all'], true) ? (string) $request->query('period') : 'week';

        return response()->json(['period' => $period, 'rows' => $rating->leaderboard($family, $period)]);
    }

    public function settings(Request $request, Family $family, WeeklyDigest $digest): JsonResponse
    {
        $member = $this->active($request, $family);
        $this->gate->authorize($member, $family, 'settings.manage');
        $preview = $digest->build($family);

        return response()->json([
            'profile' => [
                'name' => $family->name,
                'tag' => $family->tag,
                'description' => $family->description,
                'is_recruiting' => $family->is_recruiting,
                'logo_url' => $family->logo_url,
            ],
            'settings' => $family->resolvedSettings(),
            'digest' => [
                'text' => $digest->format($family, $preview),
                'members' => count($preview['lines']),
                'total' => $preview['total'],
            ],
        ]);
    }

    public function updateProfile(Request $request, Family $family, FamilyAudit $audit): JsonResponse
    {
        $this->writable($family);
        $member = $this->active($request, $family);
        $this->gate->authorize($member, $family, 'settings.manage');
        $request->merge(['tag' => strtoupper(trim($request->string('tag')->toString()))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'tag' => ['required', 'string', 'min:2', 'max:8', 'regex:/^[A-Za-z0-9А-Яа-яІіЇїЄєҐґ]+$/u', Rule::unique('families', 'tag')->where('server_id', $family->server_id)->ignore($family->id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_recruiting' => ['required', 'boolean'],
        ]);
        $before = $family->only(['name', 'tag', 'description', 'is_recruiting']);
        $family->fill($data)->save();
        $audit->log($family, 'FAMILY_UPDATE', $member, null, ['from' => $before, 'to' => $family->only(array_keys($before))]);

        return response()->json(['ok' => true]);
    }

    public function updateSettings(Request $request, Family $family, FamilyAudit $audit): JsonResponse
    {
        $this->writable($family);
        $member = $this->active($request, $family);
        $this->gate->authorize($member, $family, 'settings.manage');
        $money = ['required', 'numeric', 'min:0', 'max:10000000'];
        $points = ['required', 'integer', 'min:0', 'max:1000'];
        $data = $request->validate([
            'rates.bizwar_win' => $money,
            'rates.bizwar_loss' => $money,
            'rates.contract_light' => $money,
            'rates.contract_medium' => $money,
            'rates.contract_heavy' => $money,
            'rates.investment_cashback' => ['required', 'numeric', 'min:0', 'max:100'],
            'deposits.enabled' => ['required', 'boolean'],
            'deposits.daily_rate' => ['required', 'numeric', 'min:0', 'max:10'],
            'deposits.weekly_rate' => ['required', 'numeric', 'min:0', 'max:50'],
            'deposits.min_amount' => $money,
            'deposits.max_days' => ['required', 'integer', 'min:1', 'max:60'],
            'deposits.max_weeks' => ['required', 'integer', 'min:1', 'max:26'],
            'reports.deadline_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'reports.contract_daily_limit' => ['required', 'integer', 'min:1', 'max:50'],
            'reports.require_proof' => ['required', 'boolean'],
            'reports.max_proofs' => ['required', 'integer', 'min:1', 'max:10'],
            'rating.bizwar' => ['required', 'boolean'],
            'rating.contracts' => ['required', 'boolean'],
            'rating.investments' => ['required', 'boolean'],
            'rating.events' => ['required', 'boolean'],
            'rating.points_bizwar_win' => $points,
            'rating.points_bizwar_loss' => $points,
            'rating.points_contract_light' => $points,
            'rating.points_contract_medium' => $points,
            'rating.points_contract_heavy' => $points,
            'rating.points_per_1000' => $points,
            'rating.points_event' => $points,
            'discipline.warn_days' => ['required', 'integer', 'min:1', 'max:365'],
            'discipline.warn_limit' => ['required', 'integer', 'min:1', 'max:10'],
            'discipline.escalation' => ['required', Rule::in(['demote', 'kick'])],
            'cashout.min_amount' => $money,
            'digest.enabled' => ['required', 'boolean'],
            'digest.chat' => ['required', 'boolean'],
        ]);
        $before = $family->resolvedSettings();
        $next = $family->settings ?? [];
        foreach (Family::DEFAULT_SETTINGS as $group => $defaults) {
            foreach ($defaults as $key => $default) {
                $value = $data[$group][$key];
                $next[$group][$key] = match (true) {
                    is_bool($default) => (bool) $value,
                    is_string($default) => (string) $value,
                    is_int($default) && ! str_contains($key, 'rate') && $group !== 'rates' => (int) $value,
                    default => round((float) $value, 2),
                };
            }
        }
        $family->update(['settings' => $next]);
        $audit->log($family, 'RATE_CHANGE', $member, null, ['from' => $before, 'to' => $family->resolvedSettings()]);

        return response()->json(['ok' => true]);
    }

    public function warehouse(Request $request, Family $family): JsonResponse
    {
        $this->active($request, $family);
        $items = FamilyItem::query()->where('family_id', $family->id)->where('is_archived', false)->orderBy('name')->limit(200)->get()
            ->map(fn (FamilyItem $item) => $item->toCard())->values();

        return response()->json(['items' => $items]);
    }

    public function events(Request $request, Family $family): JsonResponse
    {
        $this->active($request, $family);
        $events = FamilyEvent::query()->where('family_id', $family->id)->orderByDesc('starts_at')->limit(40)->get()
            ->map(fn (FamilyEvent $e) => [
                'id' => $e->id,
                'title' => $e->title,
                'type' => $e->type,
                'type_label' => FamilyEvent::TYPES[$e->type] ?? $e->type,
                'status' => $e->status,
                'starts_at' => $e->starts_at->toIso8601String(),
            ])->values();

        return response()->json(['events' => $events]);
    }

    public function reports(Request $request, Family $family): JsonResponse
    {
        $member = $this->active($request, $family);
        $reports = FamilyReport::query()->where('family_id', $family->id)
            ->where(fn (Builder $q) => $q->where('beneficiary_id', $member->id)->orWhere('submitter_id', $member->id))
            ->latest('id')->limit(40)->get()
            ->map(fn (FamilyReport $r) => [
                'id' => $r->id,
                'type' => $r->type,
                'type_label' => FamilyReport::TYPES[$r->type] ?? $r->type,
                'status' => $r->status,
                'description' => $r->description,
                'reward' => $r->reward,
                'points' => $r->points,
                'event_date' => $r->event_date->toDateString(),
                'created_at' => $r->created_at->toIso8601String(),
            ])->values();

        return response()->json(['reports' => $reports]);
    }

    public function storeReport(Request $request, Family $family, ReportService $reports): JsonResponse
    {
        abort_if($family->isSuspended(), 423, 'Сім’ю призупинено платформою — зміни недоступні.');
        $member = $this->active($request, $family);
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(FamilyReport::TYPES))],
            'for' => ['required', Rule::in(['self', 'friend'])],
            'beneficiary_id' => ['nullable', 'required_if:for,friend', 'integer'],
            'event_date' => ['required', 'date_format:Y-m-d'],
            'wins' => ['nullable', 'integer', 'min:0', 'max:40'],
            'losses' => ['nullable', 'integer', 'min:0', 'max:40'],
            'hours' => ['nullable', 'array', 'max:13'],
            'hours.*' => ['integer', Rule::in(FamilyReport::HOURS)],
            'tier' => ['nullable', 'required_if:type,contract', Rule::in(array_keys(FamilyReport::TIERS))],
            'count' => ['nullable', 'integer', 'min:1', 'max:10'],
            'amount' => ['nullable', 'required_if:type,investment', 'numeric', 'min:0', 'max:100000000'],
            'description' => ['nullable', 'string', 'max:2000'],
            'proofs' => ['nullable', 'array', 'max:10'],
            'proofs.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ], [
            'beneficiary_id.required_if' => 'Оберіть друга, за якого подаєте звіт.',
            'tier.required_if' => 'Оберіть рівень контракту.',
            'amount.required_if' => 'Вкажіть суму інвестиції.',
            'proofs.*.image' => 'Доказом має бути зображення (скріншот).',
            'proofs.*.max' => 'Скріншот завеликий — до 10 МБ.',
        ]);

        $report = $reports->submit($family, $member, $data, array_values($request->file('proofs', [])));

        return response()->json([
            'report' => [
                'id' => $report->id,
                'type' => $report->type,
                'status' => $report->status,
                'reward' => $report->reward,
            ],
        ], 201);
    }

    public function queue(Request $request, Family $family, ReportService $reports): JsonResponse
    {
        $member = $this->active($request, $family);
        $can = $this->gate->abilities($member, $family);
        abort_unless($can['reports.review'] || $can['treasury.manage'], 403, 'Черга доступна офіцерам.');

        $types = collect(array_keys(FamilyReport::TYPES))->filter(fn ($t) => $can['reports.'.$t])->values()->all();
        $pending = FamilyReport::query()
            ->with(['submitter.user', 'beneficiary.user', 'proofs'])
            ->where('family_id', $family->id)
            ->where('status', FamilyReport::STATUS_PENDING)
            ->whereIn('type', $types ?: ['-'])
            ->orderBy('id')
            ->limit(100)
            ->get();

        return response()->json([
            'reports' => $pending->map(function (FamilyReport $r) use ($family, $member, $reports) {
                return [
                    'id' => $r->id,
                    'type' => $r->type,
                    'type_label' => FamilyReport::TYPES[$r->type] ?? $r->type,
                    'status' => $r->status,
                    'event_date' => $r->event_date->toDateString(),
                    'description' => $r->description,
                    'reward' => $r->reward,
                    'data' => $r->data,
                    'flags' => $r->flags,
                    'self_review' => $member->user_id !== $family->owner_id && in_array($member->id, [$r->submitter_id, $r->beneficiary_id], true),
                    'submitter' => $r->submitter->displayName(),
                    'beneficiary' => $r->beneficiary->displayName(),
                    'proofs' => $r->proofs->map(fn (FamilyReportProof $p) => ['id' => $p->id])->values(),
                    'contracts_used' => $r->type === FamilyReport::TYPE_CONTRACT
                        ? $reports->contractsUsed($r->beneficiary, (string) ($r->data['tier'] ?? 'light'), $r->event_date->toImmutable())
                        : null,
                ];
            })->values(),
            'cashouts' => $can['treasury.manage']
                ? FamilyCashout::query()->with('member')->where('family_id', $family->id)->where('status', FamilyCashout::STATUS_PENDING)->orderBy('id')->get()
                    ->map(fn (FamilyCashout $c) => FamilyBankController::cashout($c))->values()
                : [],
        ]);
    }

    public function reviewReport(Request $request, Family $family, FamilyReport $report, ReportService $reports): JsonResponse
    {
        abort_unless($report->family_id === $family->id, 404);
        abort_if($family->isSuspended(), 423, 'Сім’ю призупинено платформою — зміни недоступні.');
        $member = $this->active($request, $family);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'comment' => ['nullable', 'string', 'max:500'],
            'reward' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
        ]);

        $custom = isset($data['reward']) && $report->type === FamilyReport::TYPE_OTHER ? Money::toMinor($data['reward']) : null;
        $reports->review($family, $report, $member, $data['decision'] === 'approve', $data['comment'] ?? null, $custom);

        return response()->json(['status' => $data['decision'] === 'approve' ? FamilyReport::STATUS_APPROVED : FamilyReport::STATUS_REJECTED]);
    }

    public function proof(Request $request, Family $family, FamilyReportProof $proof): StreamedResponse
    {
        $member = $this->active($request, $family);
        $report = $proof->loadMissing('report')->report;
        abort_unless($report->family_id === $family->id, 404);
        abort_unless(
            in_array($member->id, [$report->submitter_id, $report->beneficiary_id], true) || $this->gate->can($member, $family, $report->permission()),
            403,
        );

        return Storage::disk(FamilyReportProof::DISK)->response($proof->path, null, [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    public function audit(Request $request, Family $family): JsonResponse
    {
        $member = $this->active($request, $family);
        abort_unless($this->gate->can($member, $family, 'audit.view'), 403);
        $rows = FamilyAuditLog::query()->with(['actor', 'target'])->where('family_id', $family->id)->latest('id')->limit(40)->get()
            ->map(fn (FamilyAuditLog $l) => FamilyAuditController::entry($l))->values();

        return response()->json(['entries' => $rows]);
    }

    public function servers(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $platform = $request->query('platform');
        $servers = GtaServer::query()->published()
            ->withCount(['families' => fn (Builder $query) => $query->where('status', Family::STATUS_VERIFIED)])
            ->when(is_string($platform) && $platform !== '', fn (Builder $query) => $query->where('platform', $platform))
            ->when($q !== '', fn (Builder $query) => $query->where('name', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%'))
            ->get()
            ->sortBy(fn (GtaServer $s) => [$s->is_featured ? 0 : 1, -1 * ($s->players_online ?? -1)])
            ->values()
            ->map(fn (GtaServer $s) => $s->toCard());

        return response()->json([
            'servers' => $servers,
            'platforms' => GtaServer::PLATFORMS,
        ]);
    }

    public function server(Request $request, GtaServer $server): JsonResponse
    {
        abort_unless($server->status === GtaServer::STATUS_PUBLISHED || $this->user($request)->isAdmin(), 404);
        $families = Family::query()->with('server')->where('server_id', $server->id)->where('status', Family::STATUS_VERIFIED)
            ->orderByDesc('members_count')->get()->map(fn (Family $f) => $f->toCard())->values();

        return response()->json([
            'server' => [
                ...$server->toCard(),
                'description' => $server->description,
            ],
            'families' => $families,
        ]);
    }

    public function suggestServer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'platform' => ['required', Rule::in(array_keys(GtaServer::PLATFORMS))],
            'website' => ['nullable', 'url:http,https', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $server = GtaServer::query()->create([
            ...$data,
            'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(4)),
            'status' => GtaServer::STATUS_PENDING,
            'suggested_by' => $this->user($request)->id,
            'multiplayer' => $data['platform'] === 'mobile' ? 'launcher' : 'ragemp',
            'origin' => 'suggestion',
        ]);

        return response()->json(['server' => ['id' => $server->id, 'name' => $server->name, 'status' => $server->status]], 201);
    }

    private function active(Request $request, Family $family): FamilyMember
    {
        $member = $this->gate->member($family, $this->user($request));
        abort_unless($member && $member->isActive(), 403, 'Цей розділ доступний лише учасникам сім’ї.');

        return $member;
    }

    private function writable(Family $family): void
    {
        abort_if($family->isSuspended(), 423, 'Сім’ю призупинено платформою — зміни недоступні.');
    }
}
