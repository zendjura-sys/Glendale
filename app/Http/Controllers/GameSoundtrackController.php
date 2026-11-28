<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\Playlist;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * «Музика гри»: гравці прив’язують свої публічні плейлисти до сторінки гри.
 * Прибрати може автор плейлиста або модератор.
 */
class GameSoundtrackController extends Controller
{
    public const LIMIT = 12;

    /**
     * Плейлисти гри: публічні, з треками, спершу найбільші.
     *
     * @return list<array<string, mixed>>
     */
    public static function forGame(Game $game, ?User $viewer): array
    {
        $ids = DB::table('game_playlists')->where('game_id', $game->id)->pluck('playlist_id');
        $out = [];
        foreach (Playlist::query()->with(['user', 'tracks' => fn ($q) => $q->limit(4)])->whereIn('id', $ids)->where('is_public', true)
            ->where('tracks_count', '>', 0)->orderByDesc('tracks_count')->limit(self::LIMIT)->get() as $playlist) {
            $out[] = [
                ...$playlist->toCard(),
                'author' => $playlist->user->name,
                'can_remove' => $viewer !== null && ($viewer->id === $playlist->user_id || $viewer->isStaff()),
            ];
        }

        return $out;
    }

    /** Мої публічні плейлисти, які ще не прив’язані до цієї гри (для вибору). */
    public function mine(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_soundtracks');
        $attached = DB::table('game_playlists')->where('game_id', $game->id)->pluck('playlist_id');

        return response()->json([
            'playlists' => Playlist::query()->where('user_id', $this->user($request)->id)->where('is_public', true)
                ->where('tracks_count', '>', 0)->whereNotIn('id', $attached)->latest('updated_at')->limit(50)
                ->get(['id', 'title', 'tracks_count']),
        ]);
    }

    public function store(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_soundtracks');
        $data = $request->validate(['playlist_id' => ['required', 'integer']]);
        $user = $this->user($request);
        $playlist = Playlist::query()->whereKey($data['playlist_id'])->where('user_id', $user->id)->first();
        abort_if($playlist === null, 404);
        abort_unless($playlist->is_public && $playlist->tracks_count > 0, 422, 'Прив’язати можна лише відкритий плейлист із треками.');
        DB::table('game_playlists')->insertOrIgnore(['game_id' => $game->id, 'playlist_id' => $playlist->id, 'user_id' => $user->id, 'created_at' => now()]);

        return response()->json(['playlists' => self::forGame($game, $user)]);
    }

    public function destroy(Request $request, Game $game, Playlist $playlist): JsonResponse
    {
        app(Plugins::class)->ensure('game_soundtracks');
        $user = $this->user($request);
        abort_unless($user->id === $playlist->user_id || $user->isStaff(), 403);
        DB::table('game_playlists')->where('game_id', $game->id)->where('playlist_id', $playlist->id)->delete();
        if ($user->id !== $playlist->user_id) {
            // Модератор прибрав чужий плейлист зі сторінки гри — у журнал.
            Log::info('moderation: game soundtrack removed', ['game' => $game->id, 'playlist' => $playlist->id, 'by' => $user->id]);
        }

        return response()->json(['playlists' => self::forGame($game, $user)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
