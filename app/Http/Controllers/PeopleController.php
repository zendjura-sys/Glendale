<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Search\SiteSearch;
use App\Support\Modules\ModuleManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PeopleController extends Controller
{
    public function __construct(private readonly FriendshipService $friendships) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'city' => ['nullable', 'string', 'max:80'],
            'gender' => ['nullable', Rule::in(['male', 'female'])],
            'online' => ['nullable', 'boolean'],
        ]);
        $viewer = $request->user();

        $users = $this->search($filters)
            ->whereKeyNot($viewer->id)
            ->orderByDesc('last_seen_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('people/index', [
            'filters' => [
                'q' => $filters['q'] ?? '',
                'city' => $filters['city'] ?? '',
                'gender' => $filters['gender'] ?? '',
                'online' => (bool) ($filters['online'] ?? false),
            ],
            'total' => $users->total(),
            'users' => Inertia::scroll(fn () => $users->through(fn (User $u) => [
                ...$u->toCard(),
                'city' => $u->city,
                'relation' => $this->friendships->status($viewer, $u),
                'mutual' => $this->friendships->mutualCount($viewer, $u),
            ])),
        ]);
    }

    /**
     * Швидкий пошук для рядка в шапці.
     */
    public function quick(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        if (mb_strlen($q) < 2) {
            return response()->json(['users' => [], 'communities' => []]);
        }

        return response()->json([
            'users' => $this->search(['q' => $q])->limit(8)->get()->map->toCard()->values(),
            'communities' => app(ModuleManager::class)->enabled('communities')
                ? Community::query()->search($q)->orderByDesc('members_count')->limit(4)->get()->map->toCard()->values()
                : [],
            'hits' => app(SiteSearch::class)->hits($q),
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<User>
     */
    private function search(array $filters): Builder
    {
        return User::query()
            ->whereNull('banned_at')
            ->when($filters['q'] ?? null, function (Builder $query, string $q) {
                $words = preg_split('/\s+/', trim($q));
                if ($words === false) {
                    return $query;
                }
                foreach ($words as $word) {
                    $query->where(fn (Builder $w) => $w
                        ->where('first_name', 'like', "{$word}%")
                        ->orWhere('last_name', 'like', "{$word}%")
                        ->orWhere('username', 'like', "{$word}%"));
                }

                return $query;
            })
            ->when($filters['city'] ?? null, fn (Builder $q, string $city) => $q->where('city', 'like', "{$city}%"))
            ->when($filters['gender'] ?? null, fn (Builder $q, string $gender) => $q->where('gender', $gender))
            ->when($filters['online'] ?? false, fn (Builder $q) => $q->where('last_seen_at', '>=', now()->subMinutes(5)));
    }
}
