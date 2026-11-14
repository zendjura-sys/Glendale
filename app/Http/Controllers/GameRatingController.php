<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\User;
use App\Services\Games\CommunityRatings;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Оцінка гри від гравців GameCon і позначка «Я грав». */
class GameRatingController extends Controller
{
    public function __construct(private readonly CommunityRatings $ratings, private readonly Plugins $plugins) {}

    public function rate(Request $request, Game $game): JsonResponse
    {
        $this->plugins->ensure('game_community_rating');
        $data = $request->validate(['score' => ['nullable', 'integer', 'min:1', 'max:10']]);
        $user = $this->user($request);
        if (! $this->ratings->played($user, $game)) {
            throw ValidationException::withMessages(['score' => 'Оцінювати можуть лише ті, хто грав у цю гру.']);
        }
        $this->ratings->rate($user, $game, isset($data['score']) ? (int) $data['score'] : null);

        return response()->json($this->ratings->summary($game, $user));
    }

    public function played(Request $request, Game $game): JsonResponse
    {
        $this->plugins->ensure('game_community_rating');
        $user = $this->user($request);
        $this->ratings->markPlayed($user, $game);

        return response()->json($this->ratings->summary($game, $user));
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
