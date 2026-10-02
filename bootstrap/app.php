<?php

use App\Http\Middleware\AuthenticateApiToken;
use App\Http\Middleware\EnsureEmailVerifiedWhenRequired;
use App\Http\Middleware\EnsureModuleEnabled;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TrackUserActivity;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            TrackUserActivity::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'module' => EnsureModuleEnabled::class,
            'auth.api' => AuthenticateApiToken::class,
            'admin' => EnsureUserIsAdmin::class,
            'verified.site' => EnsureEmailVerifiedWhenRequired::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Відмова в дії з Inertia-форми — тост і повернення назад замість сторінки помилки.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if ($e instanceof HttpExceptionInterface && $request->header('X-Inertia') && ! $request->isMethod('GET')
                && in_array($response->getStatusCode(), [403, 409, 422, 423, 429], true)) {
                Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage() ?: 'Дію заборонено.']);

                return back();
            }

            return $response;
        });
    })->create();
