<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Services\Developer\OAuthServer;
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

    /** @return list<array<string, mixed>> */
    private function present(Request $request): array
    {
        return array_map(fn (array $a) => [...$a, 'scope_labels' => array_map(fn (string $s) => OAuthServer::SCOPES[$s] ?? $s, $a['scopes'])], $this->oauth->connected($request->user()));
    }
}
