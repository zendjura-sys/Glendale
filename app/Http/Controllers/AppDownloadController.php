<?php

namespace App\Http\Controllers;

use App\Support\Settings\SiteSettings;
use Inertia\Inertia;
use Inertia\Response;

/** Сторінка застосунку: магазини, де він є (Адмінка → Дизайн), пряме завантаження, знімки екранів. */
class AppDownloadController extends Controller
{
    public function __invoke(SiteSettings $settings): Response
    {
        return Inertia::render('app/index', [
            'links' => (object) $settings->appLinks(),
            'version' => self::version(),
            'screens' => ['01-menu', '02-chats', '05-music', '07-cinema'],
        ]);
    }

    /** Версія застосунку з mobile/pubspec.yaml (без номера збірки). */
    private static function version(): ?string
    {
        $file = base_path('mobile/pubspec.yaml');
        if (! is_file($file) || preg_match('/^version:\s*([0-9.]+)/m', (string) file_get_contents($file), $m) !== 1) {
            return null;
        }

        return $m[1];
    }
}
