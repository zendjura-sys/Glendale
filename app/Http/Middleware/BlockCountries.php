<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Geo\GeoIp;
use App\Support\Settings\SiteSettings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Заборона відвідувань із вибраних країн (Адмінка → Країни). Адміністрацію не блокуємо,
 * вебхуки й перевірка стану працюють завжди.
 */
class BlockCountries
{
    private const OPEN = ['up', 'api/livekit/webhook', 'mail/unsubscribe/*'];

    public function __construct(private readonly SiteSettings $settings, private readonly GeoIp $geo) {}

    public function handle(Request $request, Closure $next): Response
    {
        $blocked = $this->settings->get('geo_blocked');
        if (! is_array($blocked) || $blocked === [] || $request->is(...self::OPEN)) {
            return $next($request);
        }
        $user = $request->user();
        if ($user instanceof User && $user->isStaff()) {
            return $next($request);
        }
        $country = $this->country($request);
        if ($country === null || ! in_array($country, $blocked, true)) {
            return $next($request);
        }

        $message = 'GameCon недоступний у вашій країні.';

        return $request->expectsJson() || $request->is('api/*')
            ? response()->json(['message' => $message, 'country' => $country], 451)
            : response()->view('blocked', ['message' => $message], 451);
    }

    private function country(Request $request): ?string
    {
        // За Cloudflare країну вже визначено — лише якщо в налаштуваннях сказано, що сайт за Cloudflare.
        if ($this->settings->get('geo_trust_cloudflare') === true) {
            $header = strtoupper((string) $request->header('CF-IPCountry'));
            if (preg_match('/^[A-Z]{2}$/', $header) === 1) {
                return $header;
            }
        }

        return $this->geo->country((string) $request->ip());
    }
}
