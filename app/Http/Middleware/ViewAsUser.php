<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Перегляд сайту очима людини (для адміністратора): підміняє користувача лише на GET-запитах,
 * будь-які зміни заборонені, особисте листування, телефон, налаштування й оплата — закриті.
 */
class ViewAsUser
{
    private const PRIVATE = ['messages', 'phone', 'settings', 'billing', 'notifications', 'calls', 'api'];

    public function handle(Request $request, Closure $next): Response
    {
        $targetId = $request->hasSession() ? $request->session()->get('view_as') : null;
        $admin = $request->user();
        if ($targetId === null || ! $admin instanceof User || ! $admin->isAdmin()) {
            return $next($request);
        }
        $path = $request->path();
        // Адмінка й вихід із режиму — від себе.
        if (str_starts_with($path, 'admin') || $path === 'view-as/stop' || $path === 'logout') {
            return $next($request);
        }
        abort_unless($request->isMethod('GET') || $request->isMethod('HEAD'), 403, 'Режим перегляду: лише читання. Вийдіть із режиму, щоб діяти від себе.');
        abort_if(in_array($request->segment(1), self::PRIVATE, true), 403, 'У режимі перегляду особисте листування й налаштування людини закриті.');
        $target = User::query()->whereKey((int) $targetId)->first();
        if ($target === null) {
            $request->session()->forget('view_as');

            return $next($request);
        }
        Auth::setUser($target);
        $request->attributes->set('view_as_admin', $admin->id);

        return $next($request);
    }
}
