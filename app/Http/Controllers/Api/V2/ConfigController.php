<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Social\Presenter;
use App\Support\DesignSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ConfigController extends Controller
{
    /** Публічні налаштування платформи — клієнт читає їх до входу. */
    public function config(): JsonResponse
    {
        $design = DesignSettings::all();

        return response()->json([
            'siteTitle' => $design['siteName'] ?: config('app.name', 'GameConnect'),
            'siteDescription' => '',
            // Реєстрація й вхід — на сторінках сайту (підтвердження пошти,
            // 2FA, чорні списки); SPA лише веде туди.
            'signupMode' => 'open',
            'maintenance' => false,
            'maintenanceMessage' => '',
            'accentColor' => '#d4a843',
            'aurora' => true,
            'spotifyEnabled' => false,
            'googleEnabled' => false,
            'demoAccounts' => false,
            'defaultLanguage' => 'uk',
        ]);
    }

    public function announcements(): JsonResponse
    {
        $rows = DB::table('social_announcements')->where('active', true)->orderByDesc('id')->limit(3)->get();

        return response()->json($rows->map(fn ($a) => [
            'id' => $a->id,
            'title' => $a->title,
            'body' => (string) $a->body,
            'createdAt' => Presenter::ms($a->created_at),
        ]));
    }
}
