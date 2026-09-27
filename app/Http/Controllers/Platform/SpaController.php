<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Нова платформа (соцмережа + родини + кіно) — React SPA на головному
 * домені. Сторінки родини поки на Vue (Inertia): переходи між двома
 * частинами — повне перезавантаження сторінки (go()).
 */
class SpaController extends Controller
{
    /** Адреси сторінок SPA (React Router). Решта сайту — Vue/модулі. */
    public const PAGES = [
        '/feed', '/id/{any}', '/friends', '/groups', '/club/{any}', '/photos/{any}',
        '/search', '/wall/{any}', '/activity', '/settings', '/music/{any?}',
        '/families/{any?}', '/unions/{any?}', '/cinema/{any?}',
    ];

    /** Ім'я токена: за ним відкликаємо саме токени веб-SPA, не застосунку. */
    public const TOKEN_NAME = 'web-spa';

    /**
     * Сюди приходимо після входу на сайті (redirect()->intended). Вхід на
     * сайті — Inertia-запит (XHR): звичайний редирект на сторінку SPA він
     * показати не може, тому просимо браузер повністю перейти за адресою.
     */
    public function enter(Request $request): Response|RedirectResponse
    {
        return self::go('/feed', $request);
    }

    /**
     * Перехід на сторінку SPA. Для Inertia-запиту (XHR зі сторінки на Vue)
     * звичайний редирект не спрацює — просимо браузер перейти повністю.
     */
    public static function go(string $target, Request $request): Response|RedirectResponse
    {
        return $request->header('X-Inertia') ? Inertia::location($target) : redirect($target);
    }

    public function show(Request $request): View|Response
    {
        // Посилання зі сторінки на Vue (<Link>) приходить як Inertia-запит:
        // HTML SPA він показати не може — повне перезавантаження.
        if ($request->header('X-Inertia')) {
            return Inertia::location($request->fullUrl());
        }

        return view('spa', ['base' => '']);
    }

    /**
     * Людина вже увійшла на сайті (сесія) — видаємо токен API, щоб SPA не
     * просила входити вдруге. Маршрут у web-групі: сесія + CSRF.
     */
    public function sessionToken(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['token' => null], 401);
        }

        return response()->json([
            'token' => $user->createToken(self::TOKEN_NAME)->plainTextToken,
        ]);
    }

    /** Вихід із SPA завершує й сесію сайту — інакше міст одразу впустив би назад. */
    public function logout(Request $request): JsonResponse
    {
        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['ok' => true]);
    }
}
