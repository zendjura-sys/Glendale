<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Playlist;
use App\Models\SpotifyAccount;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class MusicController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'trashed' => ['nullable', 'boolean'],
        ]);

        $tracks = Track::query()
            ->with('user')
            ->when($filters['trashed'] ?? false, fn (Builder $q) => $q->onlyTrashed())
            ->search($filters['q'] ?? null)
            ->latest('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Track $t) => [
                ...$t->toCard(),
                'size' => $t->size,
                'adds_count' => $t->adds_count,
                'user' => $t->user?->toCard(),
                'created_at' => $t->created_at->toIso8601String(),
                'deleted_at' => $t->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/music', [
            'tracks' => $tracks,
            'filters' => ['q' => $filters['q'] ?? '', 'trashed' => (bool) ($filters['trashed'] ?? false)],
            'stats' => [
                'tracks' => Track::query()->count(),
                'plays' => (int) Track::query()->sum('plays_count'),
                'size' => (int) Track::query()->sum('size'),
                'playlists' => Playlist::query()->count(),
                'spotify' => SpotifyAccount::query()->count(),
                'trashed' => Track::onlyTrashed()->count(),
            ],
        ]);
    }

    public function destroy(int $track): RedirectResponse
    {
        $model = Track::withTrashed()->findOrFail($track);

        if ($model->trashed()) {
            Storage::disk('public')->delete(array_filter([$model->path, $model->cover_path]));
            $model->forceDelete();
            $message = 'Трек видалено назавжди.';
        } else {
            $model->delete();
            $message = 'Трек переміщено в кошик.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function restore(int $track): RedirectResponse
    {
        Track::onlyTrashed()->findOrFail($track)->restore();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Трек відновлено.']);

        return back();
    }
}
