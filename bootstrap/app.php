<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php', // ADICIONE ESTA LINHA EXATAMENTE AQUI
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Глобально, а не лише у web/api-групах: API-маршрути модулів
        // (/api/messenger/...) оголошені поза "api"-групою, а polling чату
        // з телефона — саме там. Користувача TrackLastSeen читає вже
        // ПІСЛЯ обробки, коли auth/auth:sanctum маршруту його визначили.
        $middleware->append(\App\Http\Middleware\TrackLastSeen::class);

        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);

        // Isso impede que o Laravel barre o POST da Base44/SellerX
        $middleware->validateCsrfTokens(except: [
            'api/*',
            'api/nfe/*',
            'api/nfe/emitir'
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // API (мобільний застосунок, SPA) завжди отримує JSON — зокрема 401
        // замість редиректу на /login, навіть без заголовка Accept.
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*') || $request->expectsJson());
    })->create();
