<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PhotoController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'trashed' => ['nullable', 'boolean'],
        ]);

        $photos = Photo::query()
            ->with(['user', 'album.owner'])
            ->when($filters['trashed'] ?? false, fn (Builder $q) => $q->onlyTrashed())
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->where(fn (Builder $w) => $w
                ->where('caption', 'like', "%{$term}%")
                ->orWhereHas('user', fn (Builder $u) => $u->where('name', 'like', "%{$term}%")->orWhere('username', 'like', "%{$term}%"))
                ->orWhereHas('album', fn (Builder $a) => $a->where('title', 'like', "%{$term}%"))))
            ->latest('id')
            ->paginate(36)
            ->withQueryString()
            ->through(fn (Photo $p) => [
                ...$p->toThumb(),
                'caption' => $p->caption,
                'size' => $p->size,
                'user' => $p->user?->toCard(),
                'album' => ['id' => $p->album->id, 'title' => $p->album->title, 'owner' => $p->album->owner?->name],
                'created_at' => $p->created_at->toIso8601String(),
                'deleted_at' => $p->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/photos', [
            'photos' => $photos,
            'filters' => ['q' => $filters['q'] ?? '', 'trashed' => (bool) ($filters['trashed'] ?? false)],
            'stats' => [
                'photos' => Photo::query()->count(),
                'albums' => PhotoAlbum::query()->count(),
                'size' => (int) Photo::query()->sum('size'),
                'trashed' => Photo::onlyTrashed()->count(),
            ],
        ]);
    }

    public function destroy(int $photo): RedirectResponse
    {
        $model = Photo::withTrashed()->with('album')->findOrFail($photo);

        if ($model->trashed()) {
            Like::query()->where('likeable_type', $model->getMorphClass())->where('likeable_id', $model->id)->delete();
            Storage::disk('public')->delete($model->path);
            $model->forceDelete();
            $message = 'Фото видалено назавжди.';
        } else {
            $model->delete();
            $message = 'Фото переміщено в кошик.';
        }

        $model->album->recount();
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function restore(int $photo): RedirectResponse
    {
        $model = Photo::onlyTrashed()->with('album')->findOrFail($photo);
        $model->restore();
        $model->album->recount();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фото відновлено.']);

        return back();
    }
}
