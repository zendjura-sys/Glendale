<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Services\Games\SteamNews;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;

/** «Новини й патчі» на сторінці гри — підвантажується окремо, щоб Steam не гальмував сторінку. */
class GameNewsController extends Controller
{
    public function index(Game $game, SteamNews $news): JsonResponse
    {
        app(Plugins::class)->ensure('steam_patch_news');
        abort_unless($game->is_published, 404);

        return response()->json(['items' => $news->forGame($game), 'steam' => $game->steamAppId() !== null]);
    }
}
