<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\NotificationController;
use App\Models\Post;
use App\Models\User;
use App\Services\Auth\SocialLogin;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class SocialApiController extends ApiController
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly PostPresenter $presenter,
    ) {}

    public function friends(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $tab = in_array($request->query('tab'), ['all', 'online', 'requests', 'outgoing'], true) ? (string) $request->query('tab') : 'all';
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

        $relation = match ($tab) {
            'requests' => FriendshipService::INCOMING,
            'outgoing' => FriendshipService::OUTGOING,
            default => FriendshipService::FRIENDS,
        };

        $users = $query->orderByDesc('last_seen_at')->paginate(24);

        return response()->json([
            'tab' => $tab,
            'users' => $this->page($users, $users->getCollection()->map(fn (User $u) => [
                ...$u->toCard(),
                'city' => $u->city,
                'relation' => $relation,
                'mutual' => $this->friendships->mutualCount($user, $u),
            ])->values()->all()),
            'counts' => [
                'all' => count($this->friendships->friendIds($user)),
                'online' => $this->friendships->friendsQuery($user)->where('last_seen_at', '>=', now()->subMinutes(5))->count(),
                'requests' => $this->friendships->incomingCount($user),
                'outgoing' => $this->friendships->outgoingQuery($user)->count(),
            ],
        ]);
    }

    public function requestFriend(Request $request, User $user): JsonResponse
    {
        $status = $this->friendships->request($this->user($request), $user);

        return response()->json(['relation' => $status]);
    }

    public function acceptFriend(Request $request, User $user): JsonResponse
    {
        $this->friendships->accept($this->user($request), $user);

        return response()->json(['relation' => FriendshipService::FRIENDS]);
    }

    public function removeFriend(Request $request, User $user): JsonResponse
    {
        $this->friendships->remove($this->user($request), $user);

        return response()->json(['relation' => FriendshipService::NONE]);
    }

    public function people(Request $request): JsonResponse
    {
        $viewer = $this->user($request);
        $q = trim((string) $request->query('q', ''));
        $city = trim((string) $request->query('city', ''));

        $users = User::query()
            ->whereNull('banned_at')
            ->whereKeyNot($viewer->id)
            ->when($q !== '', fn (Builder $query) => $query->where(fn (Builder $w) => $w->where('name', 'like', "%{$q}%")->orWhere('username', 'like', "%{$q}%")))
            ->when($city !== '', fn (Builder $query) => $query->where('city', 'like', "%{$city}%"))
            ->when(
                is_string($request->query('gender')) && in_array($request->query('gender'), ['male', 'female'], true),
                fn (Builder $query) => $query->where('gender', $request->query('gender')),
            )
            ->when($request->boolean('online'), fn (Builder $query) => $query->where('last_seen_at', '>=', now()->subMinutes(5)))
            ->orderByDesc('last_seen_at')
            ->paginate(20);

        return response()->json([
            'users' => $this->page($users, $users->getCollection()->map(fn (User $u) => [
                ...$u->toCard(),
                'city' => $u->city,
                'relation' => $this->friendships->status($viewer, $u),
                'mutual' => $this->friendships->mutualCount($viewer, $u),
            ])->values()->all()),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['users' => [], 'communities' => []]);
        }

        $viewer = $this->user($request);
        $users = User::query()
            ->whereNull('banned_at')
            ->whereKeyNot($viewer->id)
            ->where(fn (Builder $w) => $w->where('name', 'like', "%{$q}%")->orWhere('username', 'like', "%{$q}%"))
            ->orderByDesc('last_seen_at')
            ->limit(8)
            ->get()
            ->map(fn (User $u) => [...$u->toCard(), 'relation' => $this->friendships->status($viewer, $u)])
            ->values();

        return response()->json(['users' => $users]);
    }

    public function profile(Request $request, User $user): JsonResponse
    {
        $viewer = $this->user($request);
        abort_if($user->isBanned() && ! $viewer->isStaff(), 404);

        $relation = $this->friendships->status($viewer, $user);
        $open = $viewer->is($user) || ! $user->is_private || $relation === FriendshipService::FRIENDS || $viewer->isStaff();

        $posts = Post::query()
            ->where('wall_type', $user->getMorphClass())
            ->where('wall_id', $user->id)
            ->visibleTo($viewer, $this->friendships->friendIds($viewer))
            ->orderByDesc('is_pinned')
            ->orderByDesc('id')
            ->paginate(10);

        return response()->json([
            'user' => [
                ...$user->toCard(),
                'cover_url' => $user->cover_url,
                'city' => $open ? $user->city : null,
                'about' => $open ? $user->about : null,
                'website' => $open ? $user->website : null,
                'birthday' => $open ? $user->birthday?->toDateString() : null,
                'gender' => $open ? $user->gender : null,
                'relation' => $relation,
                'friends' => count($this->friendships->friendIds($user)),
            ],
            'posts' => $open ? $this->page($posts, $this->presenter->many(new Collection($posts->items()), $viewer)) : $this->page($posts, []),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:64'],
            'last_name' => ['sometimes', 'required', 'string', 'max:64'],
            'username' => ['sometimes', 'required', 'string', 'min:3', 'max:32', 'regex:/^[a-z][a-z0-9_.]*[a-z0-9]$/i', 'not_regex:/^id\d+$/i', Rule::notIn(config('reserved.usernames')), Rule::unique(User::class)->ignore($user->id)],
            'status' => ['nullable', 'string', 'max:140'],
            'about' => ['nullable', 'string', 'max:2000'],
            'city' => ['nullable', 'string', 'max:80'],
            'birthday' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'gender' => ['nullable', Rule::in(['male', 'female'])],
            'website' => ['nullable', 'url:http,https', 'max:255'],
            'is_private' => ['sometimes', 'boolean'],
            'message_privacy' => ['sometimes', Rule::in(User::MESSAGE_PRIVACY)],
        ]);

        $user->fill($data)->save();

        return response()->json(['user' => AccountPresenter::make($user->refresh())]);
    }

    public function password(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', Password::default(), 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'Поточний пароль невірний.', 'errors' => ['current_password' => ['Поточний пароль невірний.']]], 422);
        }

        $user->forceFill(['password' => $data['password']])->save();

        return response()->json(['ok' => true]);
    }

    public function connections(Request $request, SocialLogin $social): JsonResponse
    {
        $user = $this->user($request);

        return response()->json([
            'connections' => $social->connections($user, [
                'discord' => filled(config('services.discord.client_id')),
                'google' => filled(config('services.firebase.project_id')),
            ]),
        ]);
    }

    public function unlink(Request $request, string $provider, SocialLogin $social): JsonResponse
    {
        abort_unless(array_key_exists($provider, SocialLogin::PROVIDERS), 404);
        $social->unlink($this->user($request), $provider);

        return response()->json(['ok' => true]);
    }

    public function notifications(Request $request, NotificationController $notifications): JsonResponse
    {
        return $notifications->index($request);
    }

    public function readNotifications(Request $request, NotificationController $notifications): JsonResponse
    {
        return $notifications->markAllRead($request);
    }
}
