<?php

namespace App\Http\Controllers;

use App\Models\GtaServer;
use App\Models\OAuthClient;
use App\Services\Servers\ServerOAuth;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/** Власник сервера керує застосунками «Увійти через GameCon». */
class ServerAppController extends Controller
{
    public function __construct(private readonly ServerOAuth $oauth) {}

    public function store(Request $request, GtaServer $server): RedirectResponse
    {
        $this->owner($request, $server);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'redirect_uris' => ['required', 'string', 'max:2000'],
        ]);
        [$client, $secret] = $this->oauth->createClient($server, $request->user(), trim($data['name']), preg_split('/\R/', $data['redirect_uris']) ?: []);
        session()->flash('oauth_secret', ['id' => $client->id, 'secret' => $secret]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Застосунок створено. Збережіть секрет — він показується один раз.']);

        return back();
    }

    public function update(Request $request, GtaServer $server, OAuthClient $app): RedirectResponse
    {
        $this->owner($request, $server, $app);
        $data = $request->validate(['redirect_uris' => ['required', 'string', 'max:2000']]);
        $app->update(['redirect_uris' => $this->oauth->redirects(preg_split('/\R/', $data['redirect_uris']) ?: [])]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Адреси повернення збережено.']);

        return back();
    }

    public function secret(Request $request, GtaServer $server, OAuthClient $app): RedirectResponse
    {
        $this->owner($request, $server, $app);
        session()->flash('oauth_secret', ['id' => $app->id, 'secret' => $this->oauth->rotateSecret($app)]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Новий секрет створено, старий більше не працює.']);

        return back();
    }

    public function destroy(Request $request, GtaServer $server, OAuthClient $app): RedirectResponse
    {
        $this->owner($request, $server, $app);
        $this->oauth->revoke($app);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Застосунок вимкнено, усі його входи скасовано.']);

        return back();
    }

    private function owner(Request $request, GtaServer $server, ?OAuthClient $app = null): void
    {
        abort_unless($server->owner_id === $request->user()->id || $request->user()->isAdmin(), 403);
        abort_if($app !== null && $app->gta_server_id !== $server->id, 404);
    }
}
