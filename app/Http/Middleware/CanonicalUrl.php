<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Один адрес на сторінку для пошуковиків: /games/ → /games (301). Лише GET/HEAD сторінок, не API й не файли.
 */
class CanonicalUrl
{
    public function handle(Request $request, Closure $next): Response
    {
        $path = $request->getPathInfo();
        if ($request->isMethodSafe() && $path !== '/' && str_ends_with($path, '/') && ! $request->expectsJson()) {
            $query = $request->getQueryString();

            return redirect()->to(rtrim($request->getSchemeAndHttpHost().$request->getBaseUrl().$path, '/').($query ? '?'.$query : ''), 301);
        }

        return $next($request);
    }
}
