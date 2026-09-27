<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Support\MobileRelease;
use Illuminate\Console\Command;

/**
 * Деплой (deploy/setup-vps.sh) забирає свіжу збірку застосунку на свій
 * сервер, щоб кнопка на сайті віддавала файл з власного домену. Окрема
 * команда, а не curl у скрипті: реліз приватного Glendale качається лише
 * через GitHub API з токеном (див. MobileRelease).
 */
class FetchMobileRelease extends Command
{
    protected $signature = 'mobile:fetch-release';

    protected $description = 'Завантажити свіжий APK з GitHub Release у public/downloads';

    public function handle(): int
    {
        $apk = MobileRelease::fetch('monsory-connect.apk', 180);
        if ($apk === null || strlen($apk) < 1024) {
            $this->warn('Не вдалося завантажити APK з GitHub Release — кнопка на сайті лишиться на попередній версії.');

            return self::FAILURE;
        }

        $dir = public_path('downloads');
        @mkdir($dir, 0755, true);
        file_put_contents($dir.'/monsory-connect.apk.tmp', $apk);
        rename($dir.'/monsory-connect.apk.tmp', $dir.'/monsory-connect.apk');
        $this->info('APK завантажено ('.round(strlen($apk) / 1048576, 1).' МБ).');

        // Не перезаписуємо, якщо адмін уже вручну вказав своє посилання.
        if (! Setting::get('mobile_app_download_url')) {
            Setting::set('mobile_app_download_url', '/downloads/monsory-connect.apk', 'mobile_app');
        }

        // build.txt — номер збірки (github.run_number); лише цифри.
        $build = preg_replace('/\D/', '', (string) MobileRelease::fetch('build.txt', 10));
        if ($build !== '') {
            Setting::set('mobile_app_latest_build', $build, 'mobile_app');
            $this->info("Номер збірки: {$build}");
        } else {
            $this->warn('Не вдалося прочитати build.txt — пропозиція оновитись лишиться на попередньому значенні.');
        }

        return self::SUCCESS;
    }
}
