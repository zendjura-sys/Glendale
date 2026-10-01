<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\Track;
use App\Services\ImageStorage;
use App\Services\MusicService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlaylistController extends Controller
{
    public function __construct(
        private readonly MusicService $music,
        private readonly ImageStorage $images,
    ) {}

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $playlist = $this->music->createPlaylist($request->user(), $data);

        if ($request->filled('track_id')) {
            $this->music->attach($playlist, Track::query()->findOrFail($request->integer('track_id')));
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Плейлист створено.']);

        return $request->boolean('stay') ? back() : to_route('playlists.show', $playlist);
    }

    public function show(Request $request, Playlist $playlist): Response
    {
        $viewer = $request->user();
        abort_unless($this->music->canViewPlaylist($playlist, $viewer), 404);
        $playlist->load(['user', 'tracks']);

        return Inertia::render('music/playlist', [
            'playlist' => [
                ...$playlist->toCard(),
                'covers' => $playlist->tracks->pluck('cover_url')->filter()->unique()->take(4)->values()->all(),
                'owner' => $playlist->user->toCard(),
            ],
            'tracks' => $this->music->cards($playlist->tracks, $viewer),
            'can' => ['manage' => $playlist->user_id === $viewer->id || $viewer->isStaff()],
        ]);
    }

    public function update(Request $request, Playlist $playlist): RedirectResponse
    {
        $this->authorizeOwner($request, $playlist);
        $playlist->update($this->validated($request));

        if ($request->hasFile('cover')) {
            $request->validate(['cover' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);
            $this->images->delete($playlist->cover_path);
            $playlist->forceFill(['cover_path' => $this->images->store($request->file('cover'), 'music/playlists', cover: [600, 600])['path']])->save();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Плейлист оновлено.']);

        return back();
    }

    public function destroy(Request $request, Playlist $playlist): RedirectResponse
    {
        $this->authorizeOwner($request, $playlist);
        $this->images->delete($playlist->cover_path);
        $playlist->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Плейлист видалено.']);

        return to_route('music.index', ['tab' => 'playlists']);
    }

    public function attach(Request $request, Playlist $playlist, Track $track): JsonResponse
    {
        $this->authorizeOwner($request, $playlist);
        $added = $this->music->attach($playlist, $track);

        return response()->json(['added' => $added, 'tracks_count' => $playlist->tracks_count]);
    }

    public function detach(Request $request, Playlist $playlist, Track $track): JsonResponse
    {
        $this->authorizeOwner($request, $playlist);
        $this->music->detach($playlist, $track);

        return response()->json(['tracks_count' => $playlist->tracks_count]);
    }

    private function authorizeOwner(Request $request, Playlist $playlist): void
    {
        abort_unless($playlist->user_id === $request->user()->id || $request->user()->isStaff(), 403);
    }

    /**
     * @return array{title: string, description: string|null, is_public: bool}
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_public' => ['sometimes', 'boolean'],
        ]);

        return [
            'title' => trim($data['title']),
            'description' => isset($data['description']) ? trim($data['description']) ?: null : null,
            'is_public' => (bool) ($data['is_public'] ?? true),
        ];
    }
}
