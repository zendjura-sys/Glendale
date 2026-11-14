<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Models\DeveloperApp;
use App\Services\Developer\OAuthServer;
use App\Support\Plugins\Plugins;
use Inertia\Inertia;
use Inertia\Response;

/** /developers/sdk — документація GameCon Overlay SDK з живою пісочницею (сайт і застосунок через міст). */
class SdkPageController extends Controller
{
    public function index(): Response
    {
        app(Plugins::class)->ensure('developers');

        return Inertia::render('developers/sdk', [
            'base' => rtrim(url('/'), '/'),
            'script' => url('/sdk/v1/gamecon-sdk.js'),
            'overlay' => url('/embed/overlay'),
            'defaults' => DeveloperApp::OVERLAY_DEFAULTS,
            'sections' => DeveloperApp::OVERLAY_SECTIONS,
            'scopes' => collect(OAuthServer::SCOPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values(),
            'endpoints' => [
                'authorize' => url('/oauth/authorize'),
                'token' => url('/oauth/token'),
                'device' => url('/oauth/device'),
                'link' => url('/link'),
                'api' => url('/api/developer/v1'),
            ],
        ]);
    }
}
