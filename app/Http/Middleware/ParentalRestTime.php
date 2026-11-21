<?php

namespace App\Http\Middleware;

use App\Services\ParentalControl;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Нічна пауза батьківського контролю (№227): підлітку в ці години — «Час відпочити» на сайті
 * й 423 у застосунку. Налаштування батьківського контролю й вихід лишаються доступні.
 */
class ParentalRestTime
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null || $request->is('settings/parental*', 'api/v1/site/settings/parental*', 'logout', 'api/v1/me')
            || ! app(ParentalControl::class)->resting($user)) {
            return $next($request);
        }
        $rules = app(ParentalControl::class)->rulesFor($user);
        $message = 'Час відпочити — GameCon відкриється о '.($rules['night_to'] ?? '07:00').'. Так домовились із батьками.';

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $message, 'rest_until' => $rules['night_to'] ?? null], 423);
        }

        return Inertia::render('parental/rest', ['until' => $rules['night_to'] ?? null])->toResponse($request)->setStatusCode(423);
    }
}
