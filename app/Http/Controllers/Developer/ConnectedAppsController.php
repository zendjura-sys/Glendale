<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Models\DeveloperApp;
use App\Services\Developer\OAuthServer;
use App\Services\Developer\OverlayPrefs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/** Налаштування → Підключені застосунки: кому людина дала доступ і кнопка «Відключити». */
class ConnectedAppsController extends Controller
{
    public function __construct(private readonly OAuthServer $oauth) {}

    public function index(Request $request): Response|JsonResponse
    {
        $apps = $this->present($request);
        if ($request->wantsJson()) {
            return response()->json(['apps' => $apps]);
        }

        return Inertia::render('settings/connected-apps', ['apps' => $apps]);
    }

    public function destroy(Request $request, int $app): RedirectResponse|JsonResponse
    {
        $this->oauth->disconnect($request->user(), $app);
        Log::info('oauth.disconnect', ['user' => $request->user()->id, 'app' => $app]);
        if ($request->wantsJson()) {
            return response()->json(['ok' => true, 'apps' => $this->present($request)]);
        }

        return back()->with('success', 'Доступ відкликано.');
    }

    /** Оверлей GameCon у цій грі: увімк/вимк (гравець вирішує завжди, незалежно від гри). */
    public function overlay(Request $request, int $app, OverlayPrefs $prefs): RedirectResponse|JsonResponse
    {
        $model = DeveloperApp::query()->findOrFail($app);
        $enabled = $request->validate(['enabled' => ['required', 'boolean']])['enabled'];
        $prefs->toggle($model, $request->user(), (bool) $enabled);
        Log::info('oauth.overlay', ['user' => $request->user()->id, 'app' => $model->id, 'enabled' => (bool) $enabled]);
        if ($request->wantsJson()) {
            return response()->json(['ok' => true, 'apps' => $this->present($request)]);
        }

        return back()->with('success', $enabled ? 'Оверлей у грі увімкнено.' : 'Оверлей у грі вимкнено.');
    }

    /** @return list<array<string, mixed>> */
    private function present(Request $request): array
    {
        $overlay = app(OverlayPrefs::class)->enabledMap($request->user());

        return array_map(fn (array $a) => [...$a, 'overlay' => $overlay[$a['id']] ?? true, 'scope_labels' => array_map(fn (string $s) => OAuthServer::SCOPES[$s] ?? $s, $a['scopes'])], $this->oauth->connected($request->user()));
    }
}
