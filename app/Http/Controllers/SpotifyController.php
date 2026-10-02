<?php

namespace App\Http\Controllers;

use App\Models\SpotifyAccount;
use App\Models\User;
use App\Services\Spotify\SpotifyClient;
use App\Services\Spotify\SpotifyException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class SpotifyController extends Controller
{
    public const SECTIONS = ['top', 'recent', 'saved', 'playlists'];

    public function __construct(private readonly SpotifyClient $spotify) {}

    public function connect(Request $request): HttpResponse
    {
        if (! $this->spotify->configured()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Адміністратор ще не налаштував інтеграцію зі Spotify.']);

            return to_route('music.index', ['tab' => 'spotify']);
        }

        $state = Str::random(40);
        $request->session()->put('spotify_state', $state);

        return Inertia::location($this->spotify->authorizeUrl($state));
    }

    public function callback(Request $request): RedirectResponse
    {
        $queryState = (string) $request->query('state');
        $expected = $request->session()->pull('spotify_state');
        $appUser = null;
        $fromSession = is_string($expected) && hash_equals($expected, $queryState);

        if (! $fromSession) {
            $cached = Cache::pull('spotify.oauth.'.$queryState);
            if (is_array($cached) && hash_equals($queryState, (string) ($cached['state'] ?? '')) && isset($cached['user_id'])) {
                $appUser = User::query()->find($cached['user_id']);
                if ($appUser instanceof User) {
                    $expected = $queryState;
                }
            }
        }

        $back = to_route('music.index', ['tab' => 'spotify']);
        $app = $appUser instanceof User;

        if ($request->filled('error') || ! is_string($expected) || ! hash_equals($expected, $queryState) || ! $request->filled('code')) {
            if ($app) {
                return redirect()->away('gamecon://spotify?error=1');
            }

            Inertia::flash('toast', ['type' => 'error', 'message' => $request->query('error') === 'access_denied' ? 'Ви скасували під’єднання Spotify.' : 'Не вдалося під’єднати Spotify. Спробуйте ще раз.']);

            return $back;
        }

        $owner = $appUser ?? $request->user();
        if (! $owner instanceof User) {
            return redirect()->guest(route('login'));
        }

        try {
            $token = $this->spotify->exchangeCode((string) $request->query('code'));
            $profile = $this->spotify->profile($token['access_token']);
        } catch (SpotifyException|RequestException|ConnectionException $e) {
            report($e);
            if ($app) {
                return redirect()->away('gamecon://spotify?error=1');
            }

            Inertia::flash('toast', ['type' => 'error', 'message' => $e instanceof SpotifyException ? $e->getMessage() : 'Spotify не відповідає. Спробуйте пізніше.']);

            return $back;
        }

        $owner->spotifyAccount()->updateOrCreate([], [
            'spotify_id' => $profile['id'],
            'display_name' => $profile['display_name'] ?? $profile['id'],
            'avatar_url' => $profile['images'][0]['url'] ?? null,
            'product' => $profile['product'] ?? null,
            'country' => $profile['country'] ?? null,
            'access_token' => $token['access_token'],
            'refresh_token' => $token['refresh_token'] ?? null,
            'expires_at' => now()->addSeconds((int) $token['expires_in']),
            'scopes' => $token['scope'] ?? null,
        ]);
        Cache::forget('music.now.'.$owner->id);

        if ($app) {
            return redirect()->away('gamecon://spotify?ok=1');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Spotify під’єднано! 🎧']);

        return $back;
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['show_now_playing' => ['required', 'boolean']]);
        $request->user()->spotifyAccount()->update($data);
        Cache::forget('music.now.'.$request->user()->id);

        return back();
    }

    public function disconnect(Request $request): RedirectResponse
    {
        $request->user()->spotifyAccount()->delete();
        Cache::forget('music.now.'.$request->user()->id);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Spotify від’єднано.']);

        return back();
    }

    /**
     * Свіжий токен для Web Playback SDK у браузері.
     */
    public function token(Request $request): JsonResponse
    {
        $account = $this->account($request);
        abort_unless($account->isPremium(), 403, 'Для відтворення на сайті потрібен Spotify Premium.');

        return response()->json([
            'access_token' => $this->spotify->accessToken($account),
            'expires_at' => $account->expires_at?->toIso8601String(),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:1', 'max:100']]);

        return response()->json([
            'tracks' => $this->spotify->search($data['q'], $request->user()->spotifyAccount, 20),
        ]);
    }

    public function library(Request $request, string $section): JsonResponse
    {
        abort_unless(in_array($section, self::SECTIONS, true), 404);
        $account = $this->account($request);

        $items = Cache::remember("spotify.{$account->id}.{$section}", now()->addMinutes(2), fn () => match ($section) {
            'top' => $this->spotify->topTracks($account),
            'recent' => $this->spotify->recentlyPlayed($account),
            'saved' => $this->spotify->savedTracks($account),
            'playlists' => $this->spotify->playlists($account),
        });

        return response()->json([$section === 'playlists' ? 'playlists' : 'tracks' => $items]);
    }

    public function playlist(Request $request, string $playlist): JsonResponse
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{10,40}$/', $playlist) === 1, 404);

        return response()->json(['tracks' => $this->spotify->playlistTracks($this->account($request), $playlist)]);
    }

    public function play(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => ['required', 'string', 'max:100'],
            'uris' => ['required', 'array', 'min:1', 'max:100'],
            'uris.*' => ['string', 'regex:/^spotify:track:[A-Za-z0-9]{22}$/'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $this->spotify->play($this->account($request), $data['device_id'], $data['uris'], (int) ($data['offset'] ?? 0));

        return response()->json(['ok' => true]);
    }

    private function account(Request $request): SpotifyAccount
    {
        $account = $request->user()->spotifyAccount;
        abort_if($account === null, 409, 'Спершу під’єднайте акаунт Spotify.');

        return $account;
    }
}
