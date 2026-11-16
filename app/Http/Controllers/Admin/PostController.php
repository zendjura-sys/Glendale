<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PostController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'visibility' => ['nullable', Rule::in(Post::VISIBILITIES)],
            'trashed' => ['nullable', 'boolean'],
        ]);

        $posts = Post::query()
            ->with('author')
            ->withCount('attachments')
            ->when($filters['trashed'] ?? false, fn (Builder $q) => $q->onlyTrashed())
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->where(fn (Builder $w) => $w
                ->where('body', 'like', "%{$term}%")
                ->orWhereHas('author', fn (Builder $a) => $a->where('name', 'like', "%{$term}%")->orWhere('username', 'like', "%{$term}%"))))
            ->when($filters['visibility'] ?? null, fn (Builder $q, string $v) => $q->where('visibility', $v))
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Post $p) => [
                'id' => $p->id,
                'body' => str($p->body)->limit(220)->toString(),
                'visibility' => $p->visibility,
                'author' => $p->author?->toCard(),
                'likes_count' => $p->likes_count,
                'comments_count' => $p->comments_count,
                'attachments_count' => $p->attachments_count,
                'created_at' => $p->created_at->toIso8601String(),
                'deleted_at' => $p->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/posts', [
            'posts' => $posts,
            'filters' => [
                'q' => $filters['q'] ?? '',
                'visibility' => $filters['visibility'] ?? '',
                'trashed' => (bool) ($filters['trashed'] ?? false),
            ],
        ]);
    }

    public function destroy(int $post): RedirectResponse
    {
        $model = Post::withTrashed()->findOrFail($post);

        if ($model->trashed()) {
            $model->forceDelete();
            $message = 'Запис видалено назавжди.';
        } else {
            $model->delete();
            $message = 'Запис переміщено в кошик.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function restore(int $post): RedirectResponse
    {
        Post::onlyTrashed()->findOrFail($post)->restore();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис відновлено.']);

        return back();
    }
}
