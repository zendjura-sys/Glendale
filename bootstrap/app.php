<?php

use App\Http\Middleware\AuthenticateApiToken;
use App\Http\Middleware\BlockBannedIps;
use App\Http\Middleware\BlockCountries;
use App\Http\Middleware\EnsureEmailVerifiedWhenRequired;
use App\Http\Middleware\EnsureModuleEnabled;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\TrackUserActivity;
use App\Models\Community;
use App\Services\Communities\CommunityGuests;
use App\Services\Geo\CountryRestrictions;
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
            'throttle:web-global',
            SetLocale::class,
            BlockCountries::class,
            BlockBannedIps::class,
            TrackUserActivity::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->api(append: ['throttle:api-global', SetLocale::class, BlockCountries::class, BlockBannedIps::class]);
        // Мова з cookie читається до розшифрування — вона не секретна.
        $middleware->encryptCookies(except: ['locale']);

        // «Відписатися одним натисканням» з Gmail надсилає POST без CSRF-токена; посилання підписане.
        $middleware->validateCsrfTokens(except: ['mail/unsubscribe/*', 'billing/monobank/webhook', 'billing/google-play/rtdn']);

        // Гість відкрив сторінку спільноти, яку дозволено переглядати без акаунта, — гостьова сторінка замість входу.
        $middleware->redirectGuestsTo(function (Request $request) {
            if ($request->isMethod('GET') && preg_match('~^c/([a-z][a-z0-9_]*)(/channels(/\d+)?)?$~', $request->path(), $m) === 1) {
                $community = Community::query()->where('slug', $m[1])->first();
                if ($community !== null && app(CommunityGuests::class)->canView($community)) {
                    return "/c/{$community->slug}/guest";
                }
            }

            return route('login');
        });

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
            $status = $response->getStatusCode();
            if ($request->header('X-Inertia') && ! $request->isMethod('GET')) {
                // Сторінка застаріла (CSRF) — тост і назад, без втрати введеного.
                if ($status === 419) {
                    Inertia::flash('toast', ['type' => 'error', 'message' => 'Сторінка застаріла. Спробуйте ще раз.']);

                    return back();
                }
                if ($e instanceof HttpExceptionInterface && in_array($status, [403, 409, 422, 423, 429], true)) {
                    Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage() ?: 'Дію заборонено.']);

                    return back();
                }
            }

            // Власні сторінки помилок у стилі сайту (у режимі налагодження лишаємо звичайний звіт Laravel).
            if ($request->isMethod('GET') && ! $request->expectsJson() && ! $request->is('api/*')
                && in_array($status, [403, 404, 410, 429, 500, 503], true) && (! config('app.debug') || $status !== 500)) {
                try {
                    // Розділ закритий для країни відвідувача — нейтральне пояснення замість загального тексту 403.
                    $message = $e instanceof HttpExceptionInterface && $e->getMessage() === CountryRestrictions::MESSAGE ? $e->getMessage() : null;

                    return Inertia::render('error', ['status' => $status, 'message' => $message])->toResponse($request)->setStatusCode($status);
                } catch (Throwable) {
                    // Не вийшло показати сторінку застосунку — лишається HTML із resources/views/errors.
                }
            }

            return $response;
        });
    })->create();
