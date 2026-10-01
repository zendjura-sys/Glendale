<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(User::ROLES)],
            'status' => ['nullable', Rule::in(['active', 'banned', 'online', 'verified'])],
            'sort' => ['nullable', Rule::in(['newest', 'oldest', 'last_seen', 'name'])],
        ]);

        $users = User::query()
            ->withCount('posts')
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->where(fn (Builder $w) => $w
                ->where('name', 'like', "%{$term}%")
                ->orWhere('username', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%")
                ->orWhere('id', ctype_digit($term) ? (int) $term : 0)))
            ->when($filters['role'] ?? null, fn (Builder $q, string $role) => $q->where('role', $role))
            ->when(($filters['status'] ?? null) === 'banned', fn (Builder $q) => $q->whereNotNull('banned_at'))
            ->when(($filters['status'] ?? null) === 'active', fn (Builder $q) => $q->whereNull('banned_at'))
            ->when(($filters['status'] ?? null) === 'online', fn (Builder $q) => $q->where('last_seen_at', '>=', now()->subMinutes(5)))
            ->when(($filters['status'] ?? null) === 'verified', fn (Builder $q) => $q->where('is_verified', true))
            ->tap(fn (Builder $q) => match ($filters['sort'] ?? 'newest') {
                'oldest' => $q->oldest('id'),
                'last_seen' => $q->orderByDesc('last_seen_at'),
                'name' => $q->orderBy('name'),
                default => $q->latest('id'),
            })
            ->paginate(25)
            ->withQueryString()
            ->through(fn (User $u) => [
                ...$u->toCard(),
                'email' => $u->email,
                'role' => $u->role,
                'city' => $u->city,
                'posts_count' => $u->posts_count,
                'banned_at' => $u->banned_at?->toIso8601String(),
                'ban_reason' => $u->ban_reason,
                'last_seen_at' => $u->last_seen_at?->toIso8601String(),
                'created_at' => $u->created_at?->toIso8601String(),
                'email_verified' => $u->email_verified_at !== null,
                'two_factor' => $u->two_factor_confirmed_at !== null,
            ]);

        return Inertia::render('admin/users', [
            'users' => $users,
            'filters' => [
                'q' => $filters['q'] ?? '',
                'role' => $filters['role'] ?? '',
                'status' => $filters['status'] ?? '',
                'sort' => $filters['sort'] ?? 'newest',
            ],
            'roles' => User::ROLES,
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['sometimes', Rule::in(User::ROLES)],
            'is_verified' => ['sometimes', 'boolean'],
            'banned' => ['sometimes', 'boolean'],
            'ban_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $actor = $request->user();
        abort_if($user->is($actor) && (isset($data['role']) || ! empty($data['banned'])), 422, 'Не можна змінити роль або заблокувати себе.');

        if (isset($data['role'])) {
            $user->role = $data['role'];
        }

        if (array_key_exists('is_verified', $data)) {
            $user->is_verified = $data['is_verified'];
        }

        if (array_key_exists('banned', $data)) {
            $user->banned_at = $data['banned'] ? now() : null;
            $user->ban_reason = $data['banned'] ? ($data['ban_reason'] ?? null) : null;
        }

        $user->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => "Користувача {$user->name} оновлено."]);

        return back();
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is($request->user()), 422, 'Не можна видалити себе.');

        $user->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Користувача видалено.']);

        return back();
    }
}
