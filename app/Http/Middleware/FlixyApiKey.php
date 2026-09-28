<?php

namespace App\Http\Middleware;

use App\Cinema\CinemaSettings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Apikey-ворота для мосту CineCon (Flixy-клієнт) — той самий заголовок
 * "apikey", що очікує оригінальний Flixy-бекенд (app/Http/Middleware/CheckHeader.php
 * у вихідному коді Flixy), щоб не переписувати RetrofitClient у застосунку.
 */
class FlixyApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('apikey');
        if (! $key || ! hash_equals(CinemaSettings::flixyApiKey(), $key)) {
            return response()->json(['status' => false, 'message' => 'Unauthorized Access'], 401);
        }

        return $next($request);
    }
}
