<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CommunityMemberController extends Controller
{
    public function __construct(
        private readonly CommunityService $communities,
        private readonly FriendshipService $friendships,
    ) {}

    public function index(Request $request, Community $community): Response
    {
        $viewer = $request->user();
        $membership = $community->membershipFor($viewer);
        abort_unless($this->communities->canView($community, $viewer, $membership), 403, 'Учасників закритої спільноти бачать лише її учасники.');

        $isAdmin = (bool) $membership?->isAdmin() || $viewer->isStaff();
        $friendIds = $this->friendships->friendIds($viewer);
        $tabs = ['all', 'managers', 'friends', ...($isAdmin ? ['requests'] : [])];
        $tab = in_array($request->query('tab'), $tabs, true) ? $request->query('tab') : 'all';
        $term = trim((string) $request->query('q', ''));

        $members = $community->memberships()
            ->with('user')
            ->where('status', $tab === 'requests' ? CommunityMember::STATUS_PENDING : CommunityMember::STATUS_ACTIVE)
            ->when($tab === 'managers', fn (Builder $q) => $q->whereIn('role', CommunityMember::MANAGER_ROLES))
            ->when($tab === 'friends', fn (Builder $q) => $q->whereIn('user_id', $friendIds))
            ->when($term !== '', fn (Builder $q) => $q->whereHas('user', fn (Builder $u) => $u
                ->where('name', 'like', "%{$term}%")
                ->orWhere('username', 'like', "%{$term}%")))
            ->orderByRaw("case role when 'owner' then 0 when 'admin' then 1 when 'editor' then 2 else 3 end")
            ->orderByDesc('id')
            ->paginate(30)
            ->withQueryString();

        $members->setCollection($members->getCollection()->map(fn (CommunityMember $m) => [
            ...$m->user->toCard(),
            'role' => $m->role,
            'title' => $m->title,
            'color' => $m->color,
            'status' => $m->status,
            'joined_at' => $m->created_at?->toIso8601String(),
            'answers' => $tab === 'requests' ? ($m->answers ?? []) : [],
            'is_friend' => in_array($m->user_id, $friendIds),
        ]));

        return Inertia::render('communities/members', [
            'community' => $community->toCard(),
            'tab' => $tab,
            'q' => $term,
            'my' => $membership ? ['role' => $membership->role, 'status' => $membership->status] : null,
            'isAdmin' => $isAdmin,
            'counts' => [
                'all' => $community->members_count,
                'managers' => $community->activeMembers()->whereIn('role', CommunityMember::MANAGER_ROLES)->count(),
                'friends' => $community->activeMembers()->whereIn('user_id', $friendIds)->count(),
                'requests' => $isAdmin ? $community->memberships()->where('status', CommunityMember::STATUS_PENDING)->count() : 0,
            ],
            'members' => Inertia::scroll(fn () => $members),
        ]);
    }

    public function approve(Request $request, Community $community, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request, $community);
        $this->communities->approve($community, $user);

        return back();
    }

    public function decline(Request $request, Community $community, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request, $community);
        $community->memberships()->where('user_id', $user->id)->where('status', CommunityMember::STATUS_PENDING)->delete();

        return back();
    }

    public function role(Request $request, Community $community, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in([CommunityMember::ROLE_OWNER, CommunityMember::ROLE_ADMIN, CommunityMember::ROLE_EDITOR, CommunityMember::ROLE_MEMBER])],
        ]);

        $this->communities->setRole($community, $request->user(), $user, $data['role']);

        Inertia::flash('toast', ['type' => 'success', 'message' => $data['role'] === CommunityMember::ROLE_OWNER
            ? "Права власника передано {$user->name}."
            : 'Роль оновлено.']);

        return back();
    }

    /**
     * Підпис ролі з кольором: «Модератор», «Ветеран», «Стример» тощо.
     */
    public function title(Request $request, Community $community, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request, $community);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:32'],
            'color' => ['nullable', Rule::in(CommunityMember::COLORS)],
        ]);
        $member = $community->activeMembers()->where('user_id', $user->id)->firstOrFail();
        $title = trim((string) ($data['title'] ?? ''));
        $member->update([
            'title' => $title === '' ? null : $title,
            'color' => $title === '' ? null : ($data['color'] ?? CommunityMember::COLORS[0]),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Підпис збережено.']);

        return back();
    }

    public function destroy(Request $request, Community $community, User $user): RedirectResponse
    {
        $this->communities->remove($community, $request->user(), $user);

        return back();
    }

    private function authorizeAdmin(Request $request, Community $community): void
    {
        $user = $request->user();
        abort_unless($community->membershipFor($user)?->isAdmin() || $user->isStaff(), 403);
    }
}
