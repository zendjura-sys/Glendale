<?php

namespace App\Providers;

use App\Addons\AddonAutoloader;
use App\Addons\CoreModules;
use Illuminate\Database\Events\MigrationsEnded;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

/**
 * Подключает активные Core/Modules/Plugins к рантайму приложения:
 * их PSR-4 автозагрузку и web/admin/api-точки входа.
 *
 * Регистрируется в bootstrap/providers.php.
 */
class AddonServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AddonAutoloader::class);
    }

    public function boot(): void
    {
        // Модулі системи родин — частина ядра: їхні міграції йдуть тим
        // самим `php artisan migrate`, але окремим кроком ПІСЛЯ міграцій
        // сайту — ранні файли модулів датовані 2024 роком і на чистій базі
        // інакше бігли б раніше за таблиці ядра (permissions, users…), від
        // яких залежать. Перейменувати їх не можна: на сервері вони вже
        // записані в migrations під цими іменами.
        Event::listen(MigrationsEnded::class, function (MigrationsEnded $event) {
            static $running = false;
            if ($running || $event->method !== 'up' || ! CoreModules::migrationPaths()) {
                return;
            }
            $running = true;
            try {
                Artisan::call('migrate', ['--path' => CoreModules::migrationPaths(), '--realpath' => true, '--force' => true]);
            } finally {
                $running = false;
            }
        });

        $autoloader = $this->app->make(AddonAutoloader::class);
        $autoloader->bootActive();

        // events — регистрация Event::listen() для межмодульной интеграции
        // (например, Progression слушает report.created от Reports). Нужна
        // и в HTTP, и в консоли (queue worker, artisan-команды), поэтому
        // грузится всегда, до проверки runningInConsole().
        $autoloader->loadEntrypoint('events');

        // Тести (теж консоль) маршрути модулів бачать — вони частина ядра.
        if ($this->app->runningInConsole() && ! $this->app->runningUnitTests()) {
            // bot-точки входа подключаются отдельной artisan-командой при
            // необходимости, а не на каждый CLI-вызов (миграции, tinker и т.п.)
            return;
        }

        $autoloader->loadEntrypoint('web');
        $autoloader->loadEntrypoint('admin');
        // api — токен-ендпоінти для мобільного застосунку (Sanctum), той
        // самий require-механізм, що й web/admin: модуль сам оголошує свої
        // Route::middleware(['auth:sanctum'])->group(...).
        $autoloader->loadEntrypoint('api');
    }
}
