<?php

namespace App\Http\Middleware;

use App\Services\Developer\OAuthServer;
use App\Support\Plugins\Plugins;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Публічний API для сторонніх застосунків: Bearer-токен OAuth і потрібні права (oauth:profile,friends).
 * Відповіді помилок — у форматі RFC 6750 (WWW-Authenticate).
 */
class AuthenticateOAuthToken
{
    /** Запитів на хвилину на один токен. */
    public const PER_MINUTE = 120;

    public function __construct(private readonly OAuthServer $oauth) {}

    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        if (! app(Plugins::class)->on('developers')) {
            return response()->json(['error' => 'not_available', 'message' => 'API для розробників вимкнено.'], 404);
        }
        $bearer = $request->bearerToken();
        $token = $bearer ? $this->oauth->resolve($bearer) : null;
        if ($token === null) {
            return response()->json(['error' => 'invalid_token', 'message' => 'Токен відсутній, прострочений або відкликаний.'], 401)
                ->header('WWW-Authenticate', 'Bearer realm="GameCon", error="invalid_token"');
        }
        foreach ($scopes as $scope) {
            if (! $token->can($scope)) {
                return response()->json(['error' => 'insufficient_scope', 'message' => "Потрібне право «{$scope}».", 'scope' => $scope], 403)
                    ->header('WWW-Authenticate', 'Bearer realm="GameCon", error="insufficient_scope", scope="'.$scope.'"');
            }
        }
        $key = 'oauth-api:'.$token->id;
        if (RateLimiter::tooManyAttempts($key, self::PER_MINUTE)) {
            return response()->json(['error' => 'rate_limited', 'message' => 'Забагато запитів. Спробуйте за хвилину.'], 429)
                ->header('Retry-After', (string) RateLimiter::availableIn($key));
        }
        RateLimiter::hit($key, 60);
        if ($token->last_used_at === null || $token->last_used_at->lt(now()->subMinute())) {
            $token->forceFill(['last_used_at' => now()])->saveQuietly();
        }
        $request->setUserResolver(fn () => $token->user);
        $request->attributes->set('oauth_token', $token);

        $response = $next($request);
        $response->headers->set('X-RateLimit-Limit', (string) self::PER_MINUTE);
        $response->headers->set('X-RateLimit-Remaining', (string) RateLimiter::remaining($key, self::PER_MINUTE));

        return $response;
    }
}
