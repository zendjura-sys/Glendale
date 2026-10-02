<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Families\FamilyAuditController;
use App\Http\Controllers\Families\FamilyBankController;
use App\Http\Controllers\Families\FamilyBaseController;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Family;
use App\Models\FamilyAuditLog;
use App\Models\FamilyEvent;
use App\Models\FamilyItem;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Models\FamilyTransaction;
use App\Models\GtaServer;
use App\Models\Post;
use App\Services\CommunityService;
use App\Services\Families\FamilyGate;
use App\Services\Families\FamilyService;
use App\Services\PostPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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

    public function family(Request $request, Family $family): JsonResponse
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

        return response()->json([
            'family' => [...$family->toCard(), 'description' => $family->description, 'treasury' => $family->treasury],
            'member' => [
                'status' => $member->status,
                'display' => $member->displayName(),
                'rank' => $member->rank,
                'rank_title' => $family->rankTitle($member->rank),
                'balance' => $member->balance,
            ],
            'abilities' => $this->gate->abilities($member, $family),
            'chat_id' => $family->conversation_id,
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
        $this->active($request, $family);
        $members = FamilyMember::query()->with('user')->where('family_id', $family->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)->orderByDesc('rank')->get()
            ->map(fn (FamilyMember $m) => $m->toCard($family))->values();

        return response()->json(['members' => $members]);
    }

    public function bank(Request $request, Family $family): JsonResponse
    {
        $member = $this->active($request, $family);
        $rows = FamilyTransaction::query()->where('member_id', $member->id)->latest('id')->limit(40)->get()
            ->map(fn (FamilyTransaction $t) => FamilyBankController::transaction($t, $family))->values();

        return response()->json(['balance' => $member->balance, 'transactions' => $rows]);
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
}
