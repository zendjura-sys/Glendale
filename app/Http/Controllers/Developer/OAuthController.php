<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Http\Controllers\OAuth\AuthorizeController;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Services\Developer\OAuthServer;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * OAuth 2.1: /oauth/authorize (екран згоди), /oauth/token, /oauth/revoke і метадані RFC 8414.
 */
class OAuthController extends Controller
{
    public function __construct(private readonly OAuthServer $oauth) {}

    /** Екран «Застосунок X просить доступ до…». Помилки клієнта й адреси показуємо тут, нікуди не перенаправляючи. */
    public function authorize(Request $request): Response|HttpResponse
    {
        // Клієнти серверів («Увійти через GameCon» для GTA-серверів) — свій обробник.
        if (! DeveloperApp::query()->where('client_id', (string) $request->query('client_id'))->exists()) {
            return app(AuthorizeController::class)->show($request);
        }
        app(Plugins::class)->ensure('developers');
        [$app, $redirect, $error] = $this->client($request);
        if ($error !== null) {
            return Inertia::render('developers/authorize', ['error' => $error]);
        }
        $fail = fn (string $code, string $text) => Inertia::location($this->back($redirect, ['error' => $code, 'error_description' => $text, 'state' => $request->query('state')]));
        if ($request->query('response_type') !== 'code') {
            return $fail('unsupported_response_type', 'Підтримується лише response_type=code.');
        }
        // PKCE (лише S256) обов’язковий для публічних клієнтів; конфіденційні (із секретом —
        // плагіни форумів і CMS) можуть без нього: код без секрету все одно не обміняти.
        $challenge = (string) $request->query('code_challenge', '');
        if (! ($challenge === '' && $app->confidential) && (preg_match('/^[A-Za-z0-9\-_]{43}$/', $challenge) !== 1 || $request->query('code_challenge_method') !== 'S256')) {
            return $fail('invalid_request', 'Потрібен PKCE: code_challenge і code_challenge_method=S256.');
        }
        $scopes = $this->oauth->scopes($app, $request->query('scope'));
        if ($scopes === null) {
            return $fail('invalid_scope', 'Застосунок просить права, яких не має.');
        }
        $user = $request->user();
        // Вже давали ці права й не відкликали — не питаємо вдруге (prompt=consent — питати завжди).
        $granted = DeveloperToken::query()->where('user_id', $user->id)->where('developer_app_id', $app->id)->whereNull('revoked_at')
            ->where('refresh_expires_at', '>', now())->get()->flatMap(fn (DeveloperToken $t) => $t->scopes)->unique()->all();
        if ($request->query('prompt') !== 'consent' && array_diff($scopes, $granted) === []) {
            return Inertia::location($this->back($redirect, ['code' => $this->oauth->issueCode($app, $user, $scopes, $redirect, $challenge), 'state' => $request->query('state')]));
        }

        return Inertia::render('developers/authorize', [
            'error' => null,
            'app' => ['name' => $app->name, 'description' => $app->description, 'website' => $app->website, 'author' => $app->user->name, 'created_at' => $app->created_at?->toIso8601String()],
            'scopes' => array_map(fn (string $s) => ['key' => $s, 'label' => OAuthServer::SCOPES[$s]], $scopes),
            'redirect_host' => parse_url($redirect, PHP_URL_HOST) ?: $redirect,
            'query' => $request->only(['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method']),
        ]);
    }

    /** Відповідь людини на екрані згоди. */
    public function decide(Request $request): Response|HttpResponse
    {
        if (is_array($request->input('query'))) {
            return app(AuthorizeController::class)->decide($request);
        }
        app(Plugins::class)->ensure('developers');
        [$app, $redirect, $error] = $this->client($request);
        if ($error !== null) {
            return Inertia::render('developers/authorize', ['error' => $error]);
        }
        $state = $request->input('state');
        if (! $request->boolean('approve')) {
            return Inertia::location($this->back($redirect, ['error' => 'access_denied', 'error_description' => 'Людина відмовила в доступі.', 'state' => $state]));
        }
        $challenge = (string) $request->input('code_challenge', '');
        $scopes = $this->oauth->scopes($app, $request->input('scope'));
        if ($scopes === null || (! ($challenge === '' && $app->confidential) && preg_match('/^[A-Za-z0-9\-_]{43}$/', $challenge) !== 1)) {
            return Inertia::location($this->back($redirect, ['error' => 'invalid_request', 'state' => $state]));
        }
        Log::info('oauth.authorize', ['user' => $request->user()->id, 'app' => $app->id, 'scopes' => $scopes]);

        return Inertia::location($this->back($redirect, ['code' => $this->oauth->issueCode($app, $request->user(), $scopes, $redirect, $challenge), 'state' => $state]));
    }

    /** RFC 6749 §3.2: authorization_code (з PKCE) і refresh_token. */
    public function token(Request $request): JsonResponse
    {
        if (! app(Plugins::class)->on('developers')) {
            return $this->error('invalid_request', 'API для розробників вимкнено.', 404);
        }
        [$clientId, $secret] = $this->credentials($request);
        $app = $this->oauth->client($clientId, $secret);
        if ($app === null) {
            return $this->error('invalid_client', 'Невідомий застосунок або неправильний секрет.', 401)
                ->header('WWW-Authenticate', 'Basic realm="GameCon"');
        }
        $result = match ($request->input('grant_type')) {
            'authorization_code' => $this->oauth->exchangeCode($app, (string) $request->input('code'), (string) $request->input('redirect_uri'), (string) $request->input('code_verifier')),
            'refresh_token' => $this->oauth->refresh($app, (string) $request->input('refresh_token'), $request->input('scope')),
            default => 'unsupported_grant_type',
        };
        if (is_string($result)) {
            return $this->error($result, match ($result) {
                'invalid_grant' => 'Код чи refresh-токен недійсний, прострочений, уже використаний або не збігся code_verifier / redirect_uri.',
                'invalid_scope' => 'Не можна розширити права при оновленні токена.',
                default => 'Підтримуються лише authorization_code і refresh_token.',
            });
        }

        return response()->json($result)->header('Cache-Control', 'no-store')->header('Pragma', 'no-cache');
    }

    /** RFC 7009. */
    public function revoke(Request $request): JsonResponse
    {
        [$clientId, $secret] = $this->credentials($request);
        $app = $this->oauth->client($clientId, $secret);
        if ($app === null) {
            return $this->error('invalid_client', 'Невідомий застосунок або неправильний секрет.', 401);
        }
        $this->oauth->revoke($app, (string) $request->input('token'));

        return response()->json([]);
    }

    /** RFC 8414: метадані сервера авторизації. */
    public function metadata(): JsonResponse
    {
        return response()->json([
            'issuer' => url('/'),
            'authorization_endpoint' => url('/oauth/authorize'),
            'token_endpoint' => url('/oauth/token'),
            'revocation_endpoint' => url('/oauth/revoke'),
            'userinfo_endpoint' => url('/api/developer/v1/userinfo'),
            'scopes_supported' => array_keys(OAuthServer::SCOPES),
            'response_types_supported' => ['code'],
            'grant_types_supported' => ['authorization_code', 'refresh_token'],
            'code_challenge_methods_supported' => ['S256'],
            'token_endpoint_auth_methods_supported' => ['client_secret_basic', 'client_secret_post', 'none'],
            'service_documentation' => url('/developers'),
        ]);
    }

    /** @return array{0: DeveloperApp|null, 1: string, 2: string|null} */
    private function client(Request $request): array
    {
        $app = DeveloperApp::query()->with('user')->where('client_id', (string) $request->input('client_id'))->first();
        $redirect = (string) $request->input('redirect_uri', '');
        if ($app === null) {
            return [null, '', 'Невідомий застосунок (client_id).'];
        }
        if ($app->blocked()) {
            return [null, '', 'Застосунок «'.$app->name.'» заблоковано адміністрацією.'];
        }
        if ($redirect === '' && count($app->redirect_uris) === 1) {
            $redirect = $app->redirect_uris[0];
        }
        if (! OAuthServer::redirectAllowed($app, $redirect)) {
            return [null, '', 'Адреса повернення (redirect_uri) не збігається з тією, що вказав розробник.'];
        }

        return [$app, $redirect, null];
    }

    /** @return array{0: string|null, 1: string|null} */
    private function credentials(Request $request): array
    {
        $header = (string) $request->header('Authorization', '');
        if (str_starts_with($header, 'Basic ')) {
            $pair = explode(':', (string) base64_decode(substr($header, 6), true), 2);

            return [urldecode($pair[0]), isset($pair[1]) ? urldecode($pair[1]) : null];
        }

        return [$request->input('client_id'), $request->input('client_secret')];
    }

    /** @param array<string, mixed> $params */
    private function back(string $redirect, array $params): string
    {
        $params = array_filter($params, fn ($v) => $v !== null && $v !== '');
        $params['iss'] = url('/'); // RFC 9207

        return $redirect.(str_contains($redirect, '?') ? '&' : '?').http_build_query($params);
    }

    private function error(string $code, string $text, int $status = 400): JsonResponse
    {
        return response()->json(['error' => $code, 'error_description' => $text], $status)->header('Cache-Control', 'no-store');
    }
}
