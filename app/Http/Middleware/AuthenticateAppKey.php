<?php

namespace App\Http\Middleware;

use App\Services\Developer\OAuthServer;
use App\Support\Plugins\Plugins;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Запити застосунку без людини: «Authorization: Bot gcb_…» (токен бота) або «X-GameCon-Key: gcp_…» (публічний ключ).
 * Лише публічні дані; ліміт — на застосунок.
 */
class AuthenticateAppKey
{
    public const PER_MINUTE = 300;

    public function __construct(private readonly OAuthServer $oauth) {}

    public function handle(Request $request, Closure $next, string $kind = 'any'): Response
    {
        if (! app(Plugins::class)->on('developers')) {
            return response()->json(['error' => 'not_available'], 404);
        }
        $header = (string) $request->header('Authorization', '');
        $value = str_starts_with($header, 'Bot ') ? trim(substr($header, 4)) : (string) $request->header('X-GameCon-Key', '');
        $app = $value !== '' ? $this->oauth->appByKey($value) : null;
        if ($app === null || ($kind === 'bot' && ! str_starts_with($value, 'gcb_'))) {
            return response()->json(['error' => 'invalid_key', 'message' => $kind === 'bot' ? 'Потрібен токен бота: Authorization: Bot gcb_…' : 'Потрібен публічний ключ (X-GameCon-Key) або токен бота.'], 401);
        }
        $key = 'app-api:'.$app->id;
        if (RateLimiter::tooManyAttempts($key, self::PER_MINUTE)) {
            return response()->json(['error' => 'rate_limited'], 429)->header('Retry-After', (string) RateLimiter::availableIn($key));
        }
        RateLimiter::hit($key, 60);
        $request->attributes->set('developer_app', $app);
        $request->attributes->set('developer_bot', str_starts_with($value, 'gcb_'));

        return $next($request);
    }
}
