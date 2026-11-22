<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Models\DeveloperApp;
use App\Services\Developer\OAuthServer;
use App\Services\Developer\OverlayPrefs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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

    /**
     * Компаньйон: налаштування оверлею гравця в цій грі з телефона чи сайту — ті самі, що шестерня
     * в оверлеї (зберігаються в акаунті, гра підхопить при наступному запуску). Дозволи — від розробника.
     */
    public function overlayPrefs(Request $request, int $app, OverlayPrefs $prefs): JsonResponse
    {
        $model = $this->connectedApp($request, $app);

        return response()->json(['data' => $this->prefsPayload($model, $prefs->get($model, $request->user()))]);
    }

    public function saveOverlayPrefs(Request $request, int $app, OverlayPrefs $prefs): JsonResponse
    {
        $model = $this->connectedApp($request, $app);
        $data = $request->validate([
            'prefs' => ['required', 'array'],
            'prefs.preset' => ['nullable', 'string', 'max:16'],
            'prefs.layout' => ['nullable', 'string', 'max:16'],
            'prefs.modules' => ['nullable', 'array', 'max:12'],
            'prefs.modules.*' => ['string', 'max:16'],
            'prefs.positions' => ['nullable', 'array', 'max:12'],
            'prefs.density' => ['nullable', 'integer'],
            'prefs.scale' => ['nullable', 'integer'],
            'prefs.gamepad' => ['nullable', 'boolean'],
            'prefs.streamer' => ['nullable', 'boolean'],
        ]);
        $saved = $prefs->save($model, $request->user(), ['prefs' => $data['prefs']]);
        Log::info('oauth.overlay_prefs', ['user' => $request->user()->id, 'app' => $model->id]);

        return response()->json(['data' => $this->prefsPayload($model, $saved)]);
    }

    public function resetOverlayPrefs(Request $request, int $app, OverlayPrefs $prefs): JsonResponse
    {
        $model = $this->connectedApp($request, $app);
        $prefs->reset($model, $request->user());

        return response()->json(['data' => $this->prefsPayload($model, $prefs->get($model, $request->user()))]);
    }

    /** Лише гра, якій людина дала доступ: чужі налаштування не відкриваємо. */
    private function connectedApp(Request $request, int $app): DeveloperApp
    {
        $connected = collect($this->oauth->connected($request->user()))->pluck('id')->all();
        abort_unless(in_array($app, $connected, true), 404);

        return DeveloperApp::query()->findOrFail($app);
    }

    /**
     * @param  array{enabled: bool, prefs: mixed, allowed: list<string>}  $state
     * @return array<string, mixed>
     */
    private function prefsPayload(DeveloperApp $app, array $state): array
    {
        $config = $app->overlayConfig();

        return [
            ...$state,
            // Типові значення гри — щоб показати, що буде після «Скинути».
            'defaults' => [
                'layout' => $config['layout'],
                'modules' => $config['modules'],
                'density' => $config['density'] ?? 84,
            ],
            'presets' => array_keys(OverlayPrefs::PRESETS),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function present(Request $request): array
    {
        $overlay = app(OverlayPrefs::class)->enabledMap($request->user());

        $user = $request->user()->id;

        return array_values(array_map(fn (array $a) => [...$a, 'overlay' => $overlay[$a['id']] ?? true, 'playing' => Cache::get("sdk_presence:{$a['id']}:{$user}"), 'scope_labels' => array_map(fn (string $s) => OAuthServer::SCOPES[$s] ?? $s, $a['scopes'])], $this->oauth->connected($request->user())));
    }
}
