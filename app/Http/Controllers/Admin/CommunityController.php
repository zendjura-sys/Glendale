<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Community;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CommunityController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(Community::TYPES)],
            'trashed' => ['nullable', 'boolean'],
        ]);

        $communities = Community::query()
            ->with('owner')
            ->withCount('posts')
            ->when($filters['trashed'] ?? false, fn (Builder $q) => $q->onlyTrashed())
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->search($term))
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->orderByDesc('members_count')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Community $c) => [
                ...$c->toCard(),
                'owner' => $c->owner?->toCard(),
                'posts_count' => $c->posts_count,
                'created_at' => $c->created_at->toIso8601String(),
                'deleted_at' => $c->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/communities', [
            'communities' => $communities,
            'filters' => [
                'q' => $filters['q'] ?? '',
                'type' => $filters['type'] ?? '',
                'trashed' => (bool) ($filters['trashed'] ?? false),
            ],
            'stats' => [
                'total' => Community::query()->count(),
                'verified' => Community::query()->where('is_verified', true)->count(),
                'members' => (int) Community::query()->sum('members_count'),
            ],
        ]);
    }

    public function update(Request $request, Community $community): RedirectResponse
    {
        $data = $request->validate(['is_verified' => ['required', 'boolean']]);
        $community->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => $data['is_verified'] ? 'Спільноту верифіковано.' : 'Верифікацію знято.']);

        return back();
    }

    public function destroy(int $community): RedirectResponse
    {
        $model = Community::withTrashed()->findOrFail($community);

        if ($model->trashed()) {
            $model->posts()->withTrashed()->forceDelete();
            $model->forceDelete();
            $message = 'Спільноту видалено назавжди.';
        } else {
            $model->delete();
            $message = 'Спільноту переміщено в кошик.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function restore(int $community): RedirectResponse
    {
        Community::onlyTrashed()->findOrFail($community)->restore();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Спільноту відновлено.']);

        return back();
    }
}
