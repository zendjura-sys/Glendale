<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FriendController extends Controller
{
    private const TABS = ['all', 'online', 'requests', 'outgoing'];

    public function __construct(private readonly FriendshipService $friendships) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : 'all';
        $search = trim((string) $request->query('q', ''));

        $query = match ($tab) {
            'requests' => $this->friendships->incomingQuery($user),
            'outgoing' => $this->friendships->outgoingQuery($user),
            'online' => $this->friendships->friendsQuery($user)->where('last_seen_at', '>=', now()->subMinutes(5)),
            default => $this->friendships->friendsQuery($user),
        };

        if ($search !== '') {
            $query->where(fn (Builder $q) => $q->where('name', 'like', "%{$search}%")->orWhere('username', 'like', "%{$search}%"));
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
            ])),
            'counts' => [
                'all' => count($this->friendships->friendIds($user)),
                'online' => $this->friendships->friendsQuery($user)->where('last_seen_at', '>=', now()->subMinutes(5))->count(),
                'requests' => $this->friendships->incomingCount($user),
                'outgoing' => $this->friendships->outgoingQuery($user)->count(),
            ],
            'suggestions' => Inertia::defer(fn () => collect($this->friendships->suggestions($user, 8))
                ->map(fn (array $s) => [...$s['user']->toCard(), 'city' => $s['user']->city, 'mutual' => $s['mutual'], 'relation' => FriendshipService::NONE])
                ->all()),
        ]);
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

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->friendships->remove($request->user(), $user);

        return back();
    }
}
