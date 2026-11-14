<?php

namespace GameCon\Socialite;

use Illuminate\Support\ServiceProvider;
use Laravel\Socialite\Contracts\Factory;

/** Реєструє драйвер Socialite «gamecon» (config/services.php → gamecon). */
class GameConServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app->make(Factory::class)->extend('gamecon', function ($app) {
            $config = $app['config']['services.gamecon'];

            return $app->make(Factory::class)->buildProvider(GameConProvider::class, $config);
        });
    }
}
