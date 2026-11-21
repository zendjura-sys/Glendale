<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\User;
use App\Services\Communities\CommunityGuests;
use App\Services\Seo\OgCards;
use App\Support\Plugins\Plugins;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Картинки для прев’ю посилань на профіль і спільноту (лише те, що й так відкрите гостям). */
class OgImageController extends Controller
{
    public function profile(string $username, OgCards $cards): BinaryFileResponse
    {
        app(Plugins::class)->ensure('og_cards');
        $user = User::query()->where('username', $username)->first();
        abort_if($user === null || $user->isBanned() || $user->isFrozen(), 404);

        return $this->file($cards->profile($user, ! $user->is_private));
    }

    public function community(string $slug, OgCards $cards): BinaryFileResponse
    {
        app(Plugins::class)->ensure('og_cards');
        $community = Community::query()->where('slug', $slug)->first();
        abort_if($community === null || ! app(CommunityGuests::class)->canView($community), 404);

        return $this->file($cards->community($community));
    }

    private function file(string $path): BinaryFileResponse
    {
        return response()->file($path, ['Content-Type' => 'image/png', 'Cache-Control' => 'public, max-age=86400']);
    }
}
