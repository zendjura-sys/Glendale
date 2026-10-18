<?php

namespace App\Http\Controllers;

use App\Models\Track;
use App\Services\MusicService;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrackController extends Controller
{
    public function __construct(private readonly MusicService $music) {}

    public function store(Request $request, SiteSettings $settings): JsonResponse
    {
        $data = $request->validate([
            'audio' => ['required', 'file', 'mimes:'.implode(',', Track::AUDIO_MIMES), 'max:'.(int) $settings->get('music_max_track_mb') * 1024],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'cover_url' => ['nullable', 'url:https', 'max:500'],
            'title' => ['required', 'string', 'max:150'],
            'artist' => ['required', 'string', 'max:150'],
            'album' => ['nullable', 'string', 'max:150'],
            'genre' => ['nullable', 'string', 'max:40'],
            'duration' => ['nullable', 'integer', 'min:0', 'max:7200'],
        ], [
            'audio.mimes' => 'Підтримуються аудіофайли: '.implode(', ', Track::AUDIO_MIMES).'.',
            'audio.max' => 'Файл завеликий (максимум '.(int) $settings->get('music_max_track_mb').' МБ).',
        ]);

        $track = $this->music->upload($request->user(), $request->file('audio'), $data, $request->file('cover'));

        return response()->json(['track' => $track->toCard(true)], 201);
    }

    public function update(Request $request, Track $track): JsonResponse
    {
        abort_unless($this->music->canManageTrack($track, $request->user()), 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'artist' => ['required', 'string', 'max:150'],
            'album' => ['nullable', 'string', 'max:150'],
            'genre' => ['nullable', 'string', 'max:40'],
            'lyrics' => ['nullable', 'string', 'max:8000'],
            'cover_url' => ['nullable', 'url:https', 'max:500'],
        ]);
        $coverUrl = $data['cover_url'] ?? null;
        unset($data['cover_url']);
        if (! app(Plugins::class)->on('lyrics')) {
            unset($data['lyrics']);
        }
        $track->update(array_map(fn ($v) => is_string($v) ? (trim($v) ?: null) : $v, $data));

        // Обкладинка з автозаповнення (каталог iTunes); стару видаляємо лише після успішного збереження нової.
        if (filled($coverUrl) && ($cover = $this->music->coverFromUrl((string) $coverUrl)) !== null) {
            $old = $track->cover_path;
            $track->update(['cover_path' => $cover]);
            if ($old) {
                Storage::disk('public')->delete($old);
            }
        }

        return response()->json(['track' => $track->toCard(true)]);
    }

    public function lyrics(Track $track): JsonResponse
    {
        app(Plugins::class)->ensure('lyrics');

        return response()->json(['lyrics' => $track->lyrics]);
    }

    public function destroy(Request $request, Track $track): JsonResponse
    {
        $user = $request->user();

        if (! $this->music->canManageTrack($track, $user)) {
            $this->music->remove($user, $track);

            return response()->json(['removed' => true]);
        }

        $track->delete();

        return response()->json(['deleted' => true]);
    }

    public function add(Request $request, Track $track): JsonResponse
    {
        $this->music->add($request->user(), $track);

        return response()->json(['in_library' => true]);
    }

    public function remove(Request $request, Track $track): JsonResponse
    {
        $this->music->remove($request->user(), $track);

        return response()->json(['in_library' => false]);
    }

    public function download(Track $track): StreamedResponse
    {
        $name = trim($track->artist.' - '.$track->title).'.'.pathinfo($track->path, PATHINFO_EXTENSION);

        return Storage::disk('public')->download($track->path, $name);
    }
}
