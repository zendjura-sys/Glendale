<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\PostPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CommunityController extends Controller
{
    public const PER_PAGE = 24;

    public function __construct(
        private readonly CommunityService $communities,
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
        private readonly ImageStorage $images,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $joined = $this->communities->joinedIds($user);
        $managed = $this->communities->managedIds($user);
        $tab = in_array($request->query('tab'), ['mine', 'managed', 'discover'], true)
            ? $request->query('tab')
            : ($joined === [] ? 'discover' : 'mine');
        $term = trim((string) $request->query('q', ''));
        $category = array_key_exists((string) $request->query('category'), Community::CATEGORIES) ? $request->query('category') : null;

        $query = Community::query()
            ->when($tab === 'mine', fn (Builder $q) => $q->whereIn('id', $joined))
            ->when($tab === 'managed', fn (Builder $q) => $q->whereIn('id', $managed))
            ->when($term !== '', fn (Builder $q) => $q->search($term))
            ->when($category, fn (Builder $q, string $c) => $q->where('category', $c))
            ->orderByDesc('is_verified')
            ->orderByDesc('members_count')
            ->orderByDesc('id');

        $statuses = CommunityMember::query()->where('user_id', $user->id)->pluck('status', 'community_id');
        $page = $query->paginate(self::PER_PAGE)->withQueryString();
        $page->setCollection($page->getCollection()->map(fn (Community $c) => [
            ...$c->toCard(),
            'membership' => $statuses[$c->id] ?? null,
            'managed' => in_array($c->id, $managed),
        ]));

        return Inertia::render('communities/index', [
            'tab' => $tab,
            'filters' => ['q' => $term, 'category' => $category],
            'categories' => Community::CATEGORIES,
            'counts' => ['mine' => count($joined), 'managed' => count($managed)],
            'communities' => Inertia::scroll(fn () => $page),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:100'],
            'type' => ['required', Rule::in(Community::TYPES)],
            'category' => ['required', Rule::in(array_keys(Community::CATEGORIES))],
            'privacy' => ['required', Rule::in(Community::PRIVACIES)],
        ]);

        $community = $this->communities->create($request->user(), [
            ...$data,
            'name' => trim($data['name']),
            'privacy' => $data['type'] === Community::TYPE_PUBLIC ? Community::PRIVACY_OPEN : $data['privacy'],
            'wall' => $data['type'] === Community::TYPE_PUBLIC ? Community::WALL_CLOSED : Community::WALL_OPEN,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Спільноту створено! Додайте аватар і опис.']);

        return to_route('communities.show', $community);
    }

    public function show(Request $request, Community $community): Response
    {
        $viewer = $request->user();
        $membership = $community->membershipFor($viewer);
        $canView = $this->communities->canView($community, $viewer, $membership);
        $friendIds = $this->friendships->friendIds($viewer);

        $posts = $community->posts()
            ->visibleTo($viewer, $friendIds)
            ->orderByDesc('is_pinned')
            ->orderByDesc('id')
            ->cursorPaginate(FeedController::PER_PAGE);
        $items = $canView ? $this->presenter->many(new Collection($posts->items()), $viewer) : [];

        $friendsInside = $community->activeMembers()->whereIn('user_id', $friendIds);

        $preview = User::query()
            ->whereIn('id', $community->activeMembers()->select('user_id'))
            ->orderByRaw('case when id in ('.(implode(',', array_map('intval', $friendIds ?: [0]))).') then 0 else 1 end')
            ->orderByDesc('last_seen_at')
            ->limit(6)
            ->get();

        $managers = $community->activeMembers()
            ->with('user')
            ->whereIn('role', [CommunityMember::ROLE_OWNER, CommunityMember::ROLE_ADMIN])
            ->orderByRaw("case when role = 'owner' then 0 else 1 end")
            ->limit(5)
            ->get();

        return Inertia::render('communities/show', [
            'community' => $this->details($community),
            'membership' => $membership ? ['status' => $membership->status, 'role' => $membership->role] : null,
            'can' => [
                'view' => $canView,
                'post' => $this->communities->canPost($community, $membership),
                'post_as_community' => (bool) $membership?->isManager(),
                'manage' => (bool) $membership?->isAdmin() || $viewer->isStaff(),
            ],
            'stats' => [
                'members' => $community->members_count,
                'posts' => $community->posts()->count(),
                'friends' => (clone $friendsInside)->count(),
                'requests' => $membership?->isAdmin() ? $community->memberships()->where('status', CommunityMember::STATUS_PENDING)->count() : 0,
            ],
            'members' => $canView ? $preview->map->toCard()->all() : [],
            'managers' => $managers->map(fn (CommunityMember $m) => [...$m->user->toCard(), 'role' => $m->role])->all(),
            'posts' => Inertia::scroll(fn () => $posts->setCollection(collect($items))),
        ]);
    }

    public function edit(Request $request, Community $community): Response
    {
        $this->authorizeAdmin($request, $community);

        return Inertia::render('communities/settings', [
            'community' => $this->details($community),
            'categories' => Community::CATEGORIES,
            'isOwner' => $community->owner_id === $request->user()->id || $request->user()->isStaff(),
        ]);
    }

    public function update(Request $request, Community $community): RedirectResponse
    {
        $this->authorizeAdmin($request, $community);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:100'],
            'slug' => [
                'required', 'string', 'min:3', 'max:32', 'regex:/^[a-z][a-z0-9_]*[a-z0-9]$/',
                Rule::notIn(CommunityService::RESERVED_SLUGS),
                Rule::unique('communities', 'slug')->ignore($community->id),
            ],
            'type' => ['required', Rule::in(Community::TYPES)],
            'privacy' => ['required', Rule::in(Community::PRIVACIES)],
            'wall' => ['required', Rule::in(Community::WALLS)],
            'category' => ['required', Rule::in(array_keys(Community::CATEGORIES))],
            'status' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:4000'],
            'website' => ['nullable', 'url:http,https', 'max:255'],
            'city' => ['nullable', 'string', 'max:80'],
        ], [
            'slug.regex' => 'Адреса може містити латинські літери, цифри та «_», починатися з літери.',
            'slug.unique' => 'Ця адреса вже зайнята.',
            'slug.not_in' => 'Ця адреса зарезервована.',
        ]);

        if ($data['type'] === Community::TYPE_PUBLIC) {
            $data['privacy'] = Community::PRIVACY_OPEN;
        }

        $openedUp = $community->isClosed() && $data['privacy'] === Community::PRIVACY_OPEN;
        $community->update($data);

        if ($openedUp) {
            $community->memberships()->where('status', CommunityMember::STATUS_PENDING)->update(['status' => CommunityMember::STATUS_ACTIVE]);
            $this->communities->recount($community);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування збережено.']);

        return to_route('communities.edit', $community);
    }

    public function updateImage(Request $request, Community $community, string $field): RedirectResponse
    {
        $this->authorizeAdmin($request, $community);
        abort_unless(in_array($field, ['avatar', 'cover'], true), 404);

        $request->validate([$field => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:15360']]);

        $stored = $this->images->store(
            $request->file($field),
            $field === 'avatar' ? 'communities/avatars' : 'communities/covers',
            cover: $field === 'avatar' ? [512, 512] : [1920, 560],
        );
        $column = "{$field}_path";
        $this->images->delete($community->{$column});
        $community->update([$column => $stored['path']]);

        Inertia::flash('toast', ['type' => 'success', 'message' => $field === 'avatar' ? 'Аватар оновлено.' : 'Обкладинку оновлено.']);

        return back();
    }

    public function destroy(Request $request, Community $community): RedirectResponse
    {
        $user = $request->user();
        abort_unless($community->owner_id === $user->id || $user->isStaff(), 403);

        $request->validate(['confirm' => ['required', 'string']]);

        if ($request->input('confirm') !== $community->slug) {
            throw ValidationException::withMessages(['confirm' => 'Введіть адресу спільноти, щоб підтвердити видалення.']);
        }

        $community->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => "Спільноту «{$community->name}» видалено."]);

        return to_route('communities.index');
    }

    public function join(Request $request, Community $community): RedirectResponse
    {
        $status = $this->communities->join($community, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => $status === CommunityMember::STATUS_PENDING
            ? 'Заявку надіслано. Чекайте на схвалення адміністратора.'
            : ($community->isPublic() ? 'Ви підписалися на сторінку.' : 'Ласкаво просимо до спільноти!')]);

        return back();
    }

    public function leave(Request $request, Community $community): RedirectResponse
    {
        $this->communities->leave($community, $request->user());

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function details(Community $community): array
    {
        return [
            ...$community->toCard(),
            'description' => $community->description,
            'website' => $community->website,
            'city' => $community->city,
            'wall' => $community->wall,
            'created_at' => $community->created_at->toIso8601String(),
        ];
    }

    private function authorizeAdmin(Request $request, Community $community): void
    {
        $user = $request->user();
        abort_unless($community->membershipFor($user)?->isAdmin() || $user->isStaff(), 403);
    }
}
