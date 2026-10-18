<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\FriendMark;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FriendController extends Controller
{
    private const TABS = ['all', 'online', 'requests', 'outgoing', 'raid', 'cinema', 'work', 'stale'];

    public function __construct(private readonly FriendshipService $friendships) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : 'all';
        $search = trim((string) $request->query('q', ''));

        $marks = FriendMark::query()->where('user_id', $user->id)->get()->keyBy('friend_id');
        $staleIds = $this->staleFriendIds($user);
        $query = match ($tab) {
            'requests' => $this->friendships->incomingQuery($user),
            'outgoing' => $this->friendships->outgoingQuery($user),
            'online' => $this->friendships->friendsQuery($user)->where('last_seen_at', '>=', now()->subMinutes(5)),
            'raid', 'cinema', 'work' => $this->friendships->friendsQuery($user)->whereIn('id', $marks->where('list', $tab)->pluck('friend_id')->all() ?: [0]),
            'stale' => $this->friendships->friendsQuery($user)->whereIn('id', $staleIds ?: [0]),
            default => $this->friendships->friendsQuery($user),
        };

        if ($search !== '') {
            $nickIds = $marks->filter(fn (FriendMark $mark) => $mark->nickname !== null && str_contains(mb_strtolower($mark->nickname), mb_strtolower($search)))->pluck('friend_id');
            $query->where(fn (Builder $q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('username', 'like', "%{$search}%")
                ->orWhereIn('id', $nickIds->all() ?: [0]));
        }

        $users = $query->orderByDesc('last_seen_at')->paginate(24)->withQueryString();
        $relation = match ($tab) {
            'requests' => FriendshipService::INCOMING,
            'outgoing' => FriendshipService::OUTGOING,
            default => FriendshipService::FRIENDS,
        };

        return Inertia::render('friends/index', [
            'tab' => $tab,
            'q' => $search,
            'users' => Inertia::scroll(fn () => $users->through(fn (User $u) => [
                ...$u->toCard(),
                'city' => $u->city,
                'relation' => $relation,
                'mutual' => $this->friendships->mutualCount($user, $u),
                'alias' => $marks->get($u->id)?->nickname,
                'note' => $marks->get($u->id)?->note,
                'list' => $marks->get($u->id)?->list,
                'markable' => $relation === FriendshipService::FRIENDS,
            ])),
            'counts' => [
                'all' => count($this->friendships->friendIds($user)),
                'online' => $this->friendships->friendsQuery($user)->where('last_seen_at', '>=', now()->subMinutes(5))->count(),
                'requests' => $this->friendships->incomingCount($user),
                'outgoing' => $this->friendships->outgoingQuery($user)->count(),
                'raid' => $marks->where('list', 'raid')->count(),
                'cinema' => $marks->where('list', 'cinema')->count(),
                'work' => $marks->where('list', 'work')->count(),
                'stale' => count($staleIds),
            ],
            'suggestions' => Inertia::defer(fn () => collect($this->friendships->suggestions($user, 8))
                ->map(fn (array $s) => [...$s['user']->toCard(), 'city' => $s['user']->city, 'mutual' => $s['mutual'], 'relation' => FriendshipService::NONE])
                ->all()),
        ]);
    }

    /**
     * @return list<int>
     */
    private function staleFriendIds(User $user): array
    {
        $friendIds = $this->friendships->friendIds($user);
        if ($friendIds === []) {
            return [];
        }

        $recent = Conversation::query()
            ->where('type', Conversation::TYPE_DIRECT)
            ->where('last_message_at', '>=', now()->subDays(30))
            ->whereHas('activeParticipants', fn ($query) => $query->where('user_id', $user->id))
            ->with(['activeParticipants' => fn ($query) => $query->where('user_id', '!=', $user->id)])
            ->get()
            ->flatMap(fn (Conversation $conversation) => $conversation->activeParticipants->pluck('user_id'))
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_diff($friendIds, $recent));
    }

    public function store(Request $request, User $user): RedirectResponse
    {
        $status = $this->friendships->request($request->user(), $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => $status === FriendshipService::FRIENDS
            ? "Ви тепер друзі з {$user->first_name}."
            : 'Заявку надіслано.']);

        return back();
    }

    public function accept(Request $request, User $user): RedirectResponse
    {
        $this->friendships->accept($request->user(), $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Ви тепер друзі з {$user->first_name}."]);

        return back();
    }

    public function mark(Request $request, User $user): RedirectResponse
    {
        $viewer = $request->user();
        abort_unless($this->friendships->status($viewer, $user) === FriendshipService::FRIENDS, 403);

        $data = $request->validate([
            'list' => ['nullable', Rule::in(FriendMark::LISTS)],
            'nickname' => ['nullable', 'string', 'max:40'],
            'note' => ['nullable', 'string', 'max:280'],
        ]);
        $nickname = trim((string) ($data['nickname'] ?? '')) ?: null;
        $note = trim((string) ($data['note'] ?? '')) ?: null;
        $list = $data['list'] ?? null;

        if ($nickname === null && $note === null && $list === null) {
            FriendMark::query()->where('user_id', $viewer->id)->where('friend_id', $user->id)->delete();
        } else {
            FriendMark::query()->updateOrCreate(
                ['user_id' => $viewer->id, 'friend_id' => $user->id],
                ['nickname' => $nickname, 'note' => $note, 'list' => $list],
            );
        }

        return back();
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->friendships->remove($request->user(), $user);

        return back();
    }
}
