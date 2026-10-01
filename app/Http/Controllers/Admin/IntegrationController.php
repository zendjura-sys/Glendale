<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MovieSource;
use App\Models\SpotifyAccount;
use App\Services\Cinema\FlixcdnPlayer;
use App\Services\Cinema\KodikClient;
use App\Services\Spotify\SpotifyClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class IntegrationController extends Controller
{
    public function __construct(
        private readonly SiteSettings $settings,
        private readonly SpotifyClient $spotify,
        private readonly KodikClient $kodik,
        private readonly FlixcdnPlayer $flixcdn,
    ) {}

    public function index(): Response
    {
        $secret = $this->spotify->clientSecret();

        return Inertia::render('admin/integrations', [
            'spotify' => [
                'client_id' => $this->spotify->clientId(),
                'secret_hint' => $secret ? Str::mask($secret, '•', 0, -4) : null,
                'from_env' => blank($this->settings->get('spotify_client_id')) && filled(config('services.spotify.client_id')),
                'configured' => $this->spotify->configured(),
                'redirect_uri' => $this->spotify->redirectUri(),
                'accounts' => SpotifyAccount::query()->count(),
                'premium' => SpotifyAccount::query()->where('product', 'premium')->count(),
                'scopes' => SpotifyClient::SCOPES,
            ],
            'kodik' => [
                'token_hint' => $this->hint($this->kodik->token()),
                'from_env' => blank($this->settings->secret('kodik_token')) && filled(config('services.kodik.token')),
                'configured' => $this->kodik->configured(),
                'sources' => MovieSource::query()->where('provider', 'kodik')->count(),
            ],
            'flixcdn' => [
                'token_hint' => $this->hint($this->flixcdn->token()),
                'template' => $this->flixcdn->template(),
                'from_env' => blank($this->settings->get('flixcdn_template')) && filled(config('services.flixcdn.template')),
                'configured' => $this->flixcdn->configured(),
                'placeholders' => FlixcdnPlayer::PLACEHOLDERS,
            ],
        ]);
    }

    public function updateSpotify(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'client_id' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{32}$/'],
            'client_secret' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{32}$/'],
            'clear' => ['sometimes', 'boolean'],
        ], [
            'client_id.regex' => 'Client ID — це 32 латинські літери та цифри.',
            'client_secret.regex' => 'Client Secret — це 32 латинські літери та цифри.',
        ]);

        if ($request->boolean('clear')) {
            $this->settings->put(['spotify_client_id' => null]);
            $this->settings->putSecret('spotify_client_secret', null);
            $this->spotify->forgetAppToken();
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Ключі Spotify видалено.']);

            return back();
        }

        $this->settings->put(['spotify_client_id' => $data['client_id'] ?? null]);
        if (filled($data['client_secret'] ?? null)) {
            $this->settings->putSecret('spotify_client_secret', $data['client_secret']);
        }
        $this->spotify->forgetAppToken();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування Spotify збережено.']);

        return back();
    }

    public function testSpotify(): RedirectResponse
    {
        $ok = $this->spotify->configured() && $this->spotify->testCredentials();

        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => 'Spotify відповідає — ключі правильні ✅']
            : ['type' => 'error', 'message' => 'Spotify відхилив ключі. Перевірте Client ID і Secret.']);

        return back();
    }

    public function updateKodik(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{16,64}$/'],
            'clear' => ['sometimes', 'boolean'],
        ], ['token.regex' => 'Токен Kodik — це 16–64 латинські літери та цифри.']);

        if ($request->boolean('clear')) {
            $this->settings->putSecret('kodik_token', null);
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Токен Kodik видалено.']);

            return back();
        }

        if (filled($data['token'] ?? null)) {
            $this->settings->putSecret('kodik_token', $data['token']);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування Kodik збережено.']);

        return back();
    }

    public function testKodik(): RedirectResponse
    {
        $ok = $this->kodik->configured() && $this->kodik->test();

        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => 'Kodik відповідає — токен правильний ✅']
            : ['type' => 'error', 'message' => 'Kodik відхилив токен або недоступний.']);

        return back();
    }

    public function updateFlixcdn(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['nullable', 'string', 'max:200', 'regex:/^[A-Za-z0-9_\-.]+$/'],
            'template' => ['nullable', 'string', 'max:500', 'url:https', function (string $attribute, mixed $value, \Closure $fail) {
                if (is_string($value) && ! str_contains($value, '{kinopoisk_id}') && ! str_contains($value, '{imdb_id}')) {
                    $fail('Шаблон має містити {kinopoisk_id} або {imdb_id}.');
                }
            }],
            'clear' => ['sometimes', 'boolean'],
        ], [
            'template.url' => 'Шаблон має бути адресою https://…',
            'token.regex' => 'Токен містить недопустимі символи.',
        ]);

        if ($request->boolean('clear')) {
            $this->settings->put(['flixcdn_template' => null]);
            $this->settings->putSecret('flixcdn_token', null);
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування FlixCDN видалено.']);

            return back();
        }

        $this->settings->put(['flixcdn_template' => $data['template'] ?? null]);
        if (filled($data['token'] ?? null)) {
            $this->settings->putSecret('flixcdn_token', $data['token']);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування FlixCDN збережено.']);

        return back();
    }

    private function hint(?string $secret): ?string
    {
        return $secret ? Str::mask($secret, '•', 0, -4) : null;
    }
}
