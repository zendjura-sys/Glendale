<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AuthenticateAppKey;
use App\Http\Middleware\AuthenticateOAuthToken;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Services\Developer\OAuthServer;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /developers: документація API й OAuth, свої застосунки, ключі (client ID, публічний, секретний),
 * токен бота й особистий OAuth-токен для тестів. Секрети показуємо один раз (флеш-повідомлення).
 */
class DeveloperPortalController extends Controller
{
    public function __construct(private readonly OAuthServer $oauth) {}

    public function index(Request $request): Response
    {
        app(Plugins::class)->ensure('developers');
        $user = $request->user();

        return Inertia::render('developers/index', [
            'apps' => $user ? DeveloperApp::query()->where('user_id', $user->id)->latest('id')->get()->map(fn (DeveloperApp $a) => $this->present($a))->values() : [],
            'scopes' => collect(OAuthServer::SCOPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values(),
            'base' => url('/'),
            'limits' => ['user' => AuthenticateOAuthToken::PER_MINUTE, 'app' => AuthenticateAppKey::PER_MINUTE, 'apps' => DeveloperApp::MAX_PER_USER],
            'reveal' => session('developer_reveal'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('developers');
        $user = $request->user();
        abort_if(DeveloperApp::query()->where('user_id', $user->id)->count() >= DeveloperApp::MAX_PER_USER, 422, 'Можна мати до '.DeveloperApp::MAX_PER_USER.' застосунків.');
        $data = $this->validated($request);
        $app = DeveloperApp::query()->create([...$data, 'user_id' => $user->id, 'client_id' => $this->oauth->newClientId(), 'public_key' => $this->oauth->newPublicKey()]);
        $reveal = ['app' => $app->id];
        if ($app->confidential) {
            $reveal['client_secret'] = $this->oauth->newSecret($app);
        }
        Log::info('developer.app.create', ['by' => $user->id, 'app' => $app->id]);

        return redirect('/developers#app-'.$app->id)->with('developer_reveal', $reveal)
            ->with('success', 'Застосунок створено. Скопіюйте секретний ключ — більше його не покажемо.');
    }

    public function update(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $app->update($this->validated($request));

        return back()->with('success', 'Збережено.');
    }

    /** Вигляд оверлею SDK у грі — кожна гра налаштовує під свій стиль. */
    public function overlay(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'accent' => ['required', 'regex:/^#[0-9a-f]{6}$/i'],
            'logo_url' => ['nullable', 'url:https', 'max:500'],
            'title' => ['nullable', 'string', 'max:40'],
            'side' => ['required', Rule::in(['left', 'right', 'top'])],
            'offset' => ['required', 'integer', 'min:5', 'max:95'],
            'hotkey' => ['required', 'string', 'max:24', 'regex:/^((Ctrl|Shift|Alt|Meta)\+){0,3}([A-Z0-9]|F([1-9]|1[0-2])|Tab|Home|End|Insert|`)$/'],
            'gamepad' => ['required', 'boolean'],
            'swipe' => ['required', 'boolean'],
            'hide_when_busy' => ['required', 'boolean'],
            'theme' => ['required', Rule::in(['dark', 'light', 'auto'])],
            'radius' => ['required', 'integer', 'min:0', 'max:32'],
            'opacity' => ['required', 'integer', 'min:60', 'max:100'],
            'toasts' => ['required', Rule::in(['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top', 'off'])],
            'tabs' => ['required', 'array', 'min:1'],
            'tabs.*' => [Rule::in(DeveloperApp::OVERLAY_TABS)],
        ], ['hotkey.regex' => 'Клавіша: напр. Shift+Tab, Ctrl+G, F10.']);
        $data['tabs'] = array_values(array_intersect(DeveloperApp::OVERLAY_TABS, $data['tabs']));
        $app->update(['overlay' => $data]);
        Cache::forget('sdk_config:'.$app->client_id);
        Log::info('developer.app.overlay', ['by' => $request->user()->id, 'app' => $app->id]);

        return back()->with('success', 'Оверлей збережено — ігри підхоплять його за кілька хвилин.');
    }

    /** Новий секретний ключ, токен бота чи публічний ключ — старий одразу перестає діяти. */
    public function rotate(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $what = $request->validate(['what' => ['required', Rule::in(['secret', 'bot', 'public'])]])['what'];
        $reveal = ['app' => $app->id];
        match ($what) {
            'secret' => $reveal['client_secret'] = $this->oauth->newSecret($app),
            'bot' => $reveal['bot_token'] = $this->oauth->newBotToken($app),
            'public' => $app->forceFill(['public_key' => $this->oauth->newPublicKey()])->save(),
        };
        Log::info('developer.app.rotate', ['by' => $request->user()->id, 'app' => $app->id, 'what' => $what]);

        return back()->with('developer_reveal', $reveal)->with('success', match ($what) {
            'secret' => 'Новий секретний ключ — скопіюйте зараз.',
            'bot' => 'Новий токен бота — скопіюйте зараз.',
            default => 'Новий публічний ключ.',
        });
    }

    /** Особистий OAuth-токен на свій акаунт для перевірки API (без браузерного входу). */
    public function personal(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $scopes = $request->validate(['scopes' => ['required', 'array', 'min:1'], 'scopes.*' => [Rule::in($app->scopes)]])['scopes'];
        $tokens = $this->oauth->personalToken($app, $request->user(), array_values(array_unique($scopes)));

        return back()->with('developer_reveal', ['app' => $app->id, 'access_token' => $tokens['access_token'], 'refresh_token' => $tokens['refresh_token']])
            ->with('success', 'Токен створено: діє годину, refresh — 30 днів.');
    }

    public function destroy(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        Log::info('developer.app.delete', ['by' => $request->user()->id, 'app' => $app->id]);
        $app->delete();

        return redirect('/developers')->with('success', 'Застосунок видалено, усі його токени відкликано.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'description' => ['nullable', 'string', 'max:300'],
            'website' => ['nullable', 'url:https', 'max:255'],
            'confidential' => ['sometimes', 'boolean'],
            'redirect_uris' => ['required', 'array', 'min:1', 'max:10'],
            // https або локальна розробка; кастомні схеми мобільних застосунків (myapp://callback) — теж.
            'redirect_uris.*' => ['required', 'string', 'max:500', 'regex:#^(https://[^\s\#]+|http://(localhost|127\.0\.0\.1)(:\d+)?(/[^\s\#]*)?|[a-z][a-z0-9+.\-]*://[^\s\#]+)$#i', 'not_regex:#^(javascript|data|file):#i'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*' => [Rule::in(array_keys(OAuthServer::SCOPES))],
        ], ['redirect_uris.*.regex' => 'Адреса повернення: https://…, http://localhost… або своя схема застосунку (myapp://…). Без #.']);
        $data['redirect_uris'] = array_values(array_unique(array_map('trim', $data['redirect_uris'])));
        $data['scopes'] = array_values(array_unique([...$data['scopes'], OAuthServer::DEFAULT_SCOPE]));
        $data['confidential'] = (bool) ($data['confidential'] ?? true);

        return $data;
    }

    private function mine(Request $request, DeveloperApp $app): void
    {
        app(Plugins::class)->ensure('developers');
        abort_unless($app->user_id === $request->user()->id, 404);
    }

    /** @return array<string, mixed> */
    private function present(DeveloperApp $app): array
    {
        return [
            'id' => $app->id,
            'name' => $app->name,
            'description' => $app->description,
            'website' => $app->website,
            'overlay' => $app->overlayConfig(),
            'client_id' => $app->client_id,
            'public_key' => $app->public_key,
            'has_secret' => $app->client_secret !== null,
            'has_bot' => $app->bot_token !== null,
            'bot_token_at' => $app->bot_token_at?->toIso8601String(),
            'confidential' => $app->confidential,
            'redirect_uris' => $app->redirect_uris,
            'scopes' => $app->scopes,
            'blocked' => $app->blocked(),
            'blocked_reason' => $app->blocked_reason,
            'users' => DeveloperToken::query()->where('developer_app_id', $app->id)->whereNull('revoked_at')->distinct()->count('user_id'),
            'created_at' => $app->created_at?->toIso8601String(),
        ];
    }
}
