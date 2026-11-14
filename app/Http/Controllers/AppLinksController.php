<?php

namespace App\Http\Controllers;

use App\Services\Billing\GooglePlay;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;

/**
 * /.well-known/assetlinks.json для Android App Links: відбитки підпису задають в Адмінка → Інтеграції
 * (Google Play), пакет — той самий, що для Google Play. Порожньо — 404 (App Links вимкнено).
 */
class AppLinksController extends Controller
{
    public function __invoke(SiteSettings $settings, GooglePlay $play): JsonResponse
    {
        $fingerprints = collect(preg_split('/[\s,]+/', (string) $settings->get('app_link_fingerprints', '')) ?: [])
            ->map(fn (string $value) => strtoupper(trim($value)))
            ->filter(fn (string $value) => preg_match('/^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/', $value) === 1)
            ->unique()
            ->values()
            ->all();
        abort_if($fingerprints === [], 404);

        return response()->json([[
            'relation' => ['delegate_permission/common.handle_all_urls'],
            'target' => [
                'namespace' => 'android_app',
                'package_name' => $play->package(),
                'sha256_cert_fingerprints' => $fingerprints,
            ],
        ]])->header('Cache-Control', 'public, max-age=3600');
    }
}
