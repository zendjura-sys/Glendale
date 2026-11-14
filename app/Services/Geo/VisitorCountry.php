<?php

namespace App\Services\Geo;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Request;

/**
 * Країна відвідувача: заголовок Cloudflare (лише якщо в адмінці сказано, що сайт за Cloudflare),
 * інакше — база «IP → країна». Null — країну не визначено.
 */
class VisitorCountry
{
    public function __construct(private readonly SiteSettings $settings, private readonly GeoIp $geo) {}

    public function of(Request $request): ?string
    {
        // За Cloudflare країну вже визначено; без нього заголовок можна підробити.
        if ($this->settings->get('geo_trust_cloudflare') === true) {
            $header = strtoupper((string) $request->header('CF-IPCountry'));
            if (preg_match('/^[A-Z]{2}$/', $header) === 1) {
                return $header;
            }
        }

        return $this->geo->country((string) $request->ip());
    }
}
