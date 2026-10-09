<?php

namespace App\Http\Middleware;

use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use Carbon\Carbon;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Мова запиту (профіль → cookie → застосунок → браузер → типова) і переклад JSON-відповідей:
 * серверні тексти українські, перед відправкою замінюються перекладом.
 */
class SetLocale
{
    public function __construct(private readonly Locales $locales, private readonly Translations $translations) {}

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->locales->resolve($request);
        App::setLocale($locale);
        Carbon::setLocale($locale);

        $response = $next($request);

        if ($locale !== Locales::SOURCE && $response instanceof JsonResponse) {
            $response->setData($this->translations->tree($response->getData(true), $locale));
        }
        $response->headers->set('Content-Language', $locale);

        return $response;
    }
}
