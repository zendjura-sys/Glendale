<?php

namespace App\Http\Controllers;

use App\Models\Track;
use App\Services\MusicService;
use App\Services\Spotify\SpotifyClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NowPlayingController extends Controller
{
    public function __construct(private readonly MusicService $music) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source' => ['required', Rule::in(['local', 'spotify'])],
            'track_id' => ['required_if:source,local', 'nullable', 'integer'],
            'track' => ['required_if:source,spotify', 'nullable', 'array'],
            'track.id' => ['required_with:track', 'string', 'regex:/^[A-Za-z0-9]{22}$/'],
            'track.title' => ['required_with:track', 'string', 'max:200'],
            'track.artist' => ['required_with:track', 'string', 'max:300'],
            'track.album' => ['nullable', 'string', 'max:200'],
            'track.duration' => ['nullable', 'integer', 'min:0', 'max:7200'],
            'track.cover_url' => ['nullable', 'url', 'max:500'],
        ]);

        if ($data['source'] === 'local') {
            $this->music->nowPlaying($request->user(), Track::query()->findOrFail($data['track_id']));
        } else {
            $this->music->nowPlaying($request->user(), null, SpotifyClient::sanitize($data['track']));
        }

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->music->stop($request->user());

        return response()->json(['ok' => true]);
    }
}
