<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AuthenticateAppKey;
use App\Http\Middleware\AuthenticateOAuthToken;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Services\Developer\OAuthServer;
use App\Services\Geo\CountryRestrictions;
use App\Support\I18n\Locales;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
            // Мови для SDK: «авто» завжди; конкретна — якщо не заборонено для країни розробника.
            'sdk_locales' => $this->canPickLocale() ? app(Locales::class)->allOptions() : [],
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

    /** Вигляд оверлею SDK у грі — чернетка; гравці бачать лише опубліковане. */
    public function overlay(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $hotkey = ['required', 'string', 'max:24', 'regex:/^((Ctrl|Shift|Alt|Meta)\\+){0,3}([A-Z0-9]|F([1-9]|1[0-2])|Tab|Home|End|Insert|`)$/'];
        $corner = Rule::in(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
        // Будь-яка додана мова, навіть вимкнена на сайті: гра може бути не перекладена українською.
        $locales = ['auto', ...app(Locales::class)->all()];
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'accent' => ['required', 'regex:/^#[0-9a-f]{6}$/i'],
            'logo_url' => ['nullable', 'url:https', 'max:500'],
            'title' => ['nullable', 'string', 'max:40'],
            'side' => ['required', Rule::in(['left', 'right', 'top'])],
            'offset' => ['required', 'integer', 'min:5', 'max:95'],
            'hotkey' => $hotkey,
            'chat_hotkey' => $hotkey,
            'gamepad' => ['required', 'boolean'],
            'swipe' => ['required', 'boolean'],
            'hide_when_busy' => ['required', 'boolean'],
            'theme' => ['required', Rule::in(['dark', 'light', 'auto'])],
            'radius' => ['required', 'integer', 'min:0', 'max:32'],
            'opacity' => ['required', 'integer', 'min:60', 'max:100'],
            'toasts' => ['required', Rule::in(['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top', 'off'])],
            'tabs' => ['required', 'array', 'min:1'],
            'tabs.*' => [Rule::in(DeveloperApp::OVERLAY_TABS)],
            'modules' => ['present', 'array'],
            'modules.*' => [Rule::in(DeveloperApp::OVERLAY_MODULES)],
            'positions' => ['required', 'array'],
            'positions.hud' => ['required', $corner],
            'positions.party' => ['required', $corner],
            'positions.family' => ['required', $corner],
            'contexts' => ['required', 'array'],
            'contexts.menu' => ['present', 'array'],
            'contexts.lobby' => ['present', 'array'],
            'contexts.match' => ['present', 'array'],
            'contexts.*.*' => [Rule::in(DeveloperApp::OVERLAY_MODULES)],
            'platforms' => ['required', 'array'],
            'platforms.*' => ['boolean'],
            'player_can' => ['present', 'array'],
            'player_can.*' => [Rule::in(DeveloperApp::OVERLAY_PLAYER_CAN)],
            'custom_items' => ['present', 'array', 'max:6'],
            'custom_items.*.label' => ['required', 'string', 'max:24'],
            'custom_items.*.url' => ['nullable', 'url:https', 'max:500'],
            'custom_items.*.command' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9_.:-]+$/i'],
            'onboarding' => ['required', 'boolean'],
            'hotkey_hint' => ['required', 'boolean'],
            'locale' => ['required', Rule::in($locales)],
        ], ['hotkey.regex' => 'Клавіша: напр. Shift+Tab, Ctrl+G, F10.', 'chat_hotkey.regex' => 'Клавіша: напр. Alt+G.']);
        // Мова SDK на вибір — лише там, де адміністрація не заборонила (Країни → Обмеження).
        if ($data['locale'] !== 'auto' && ! $this->canPickLocale()) {
            throw ValidationException::withMessages(['locale' => 'Вибір мови SDK недоступний у вашій країні.']);
        }
        $order = fn (array $list, array $all) => array_values(array_intersect($all, $list));
        $data['tabs'] = $order($data['tabs'], DeveloperApp::OVERLAY_TABS);
        $data['modules'] = $order($data['modules'], DeveloperApp::OVERLAY_MODULES);
        $data['contexts'] = array_map(fn ($l) => $order($l, DeveloperApp::OVERLAY_MODULES), array_intersect_key($data['contexts'], array_flip(['menu', 'lobby', 'match'])));
        $data['platforms'] = array_map('boolval', array_intersect_key($data['platforms'], array_flip(DeveloperApp::OVERLAY_PLATFORMS))) + array_fill_keys(DeveloperApp::OVERLAY_PLATFORMS, false);
        $data['custom_items'] = array_values(array_filter(array_map(fn ($i) => ['label' => $i['label'], 'url' => $i['url'] ?? null, 'command' => $i['command'] ?? null], $data['custom_items']), fn ($i) => $i['url'] || $i['command']));
        $app->update(['overlay_draft' => $data]);
        Log::info('developer.app.overlay_draft', ['by' => $request->user()->id, 'app' => $app->id]);

        return back()->with('success', 'Чернетку збережено. Опублікуйте, щоб гравці побачили зміни.');
    }

    /** Чернетка → гравцям; попередня версія — в історію (до 10) для відкату. */
    public function publishOverlay(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        abort_if($app->overlay_draft === null, 422, 'Немає змін для публікації.');
        $versions = $app->overlay_versions ?? [];
        if ($app->overlay !== null) {
            array_unshift($versions, ['config' => $app->overlay, 'published_at' => $app->overlay_published_at?->toIso8601String()]);
        }
        $app->update(['overlay' => $app->overlay_draft, 'overlay_draft' => null, 'overlay_versions' => array_slice($versions, 0, 10), 'overlay_published_at' => now()]);
        Cache::forget('sdk_config:'.$app->client_id);
        Log::info('developer.app.overlay_publish', ['by' => $request->user()->id, 'app' => $app->id]);

        return back()->with('success', 'Оверлей опубліковано — ігри підхоплять його за кілька хвилин.');
    }

    public function rollbackOverlay(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $index = (int) $request->validate(['version' => ['required', 'integer', 'min:0', 'max:9']])['version'];
        $version = ($app->overlay_versions ?? [])[$index] ?? null;
        abort_if($version === null, 404);
        // Відкат — це чернетка зі старої версії: розробник бачить її в прев'ю й публікує.
        $app->update(['overlay_draft' => $version['config']]);
        Log::info('developer.app.overlay_rollback', ['by' => $request->user()->id, 'app' => $app->id, 'version' => $index]);

        return back()->with('success', 'Стару версію відкрито як чернетку — перевірте й опублікуйте.');
    }

    public function discardOverlay(Request $request, DeveloperApp $app): RedirectResponse
    {
        $this->mine($request, $app);
        $app->update(['overlay_draft' => null]);
        Log::info('developer.app.overlay_discard', ['by' => $request->user()->id, 'app' => $app->id]);

        return back()->with('success', 'Чернетку скасовано.');
    }

    private function canPickLocale(): bool
    {
        return app(Plugins::class)->on('sdk_locale') && ! app(CountryRestrictions::class)->pluginBlocked('sdk_locale');
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
            'overlay' => $app->overlayDraft(),
            'overlay_dirty' => $app->overlay_draft !== null,
            'overlay_published_at' => $app->overlay_published_at?->toIso8601String(),
            'overlay_versions' => array_map(fn (array $v) => ['published_at' => $v['published_at'] ?? null], $app->overlay_versions ?? []),
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
