<?php

namespace App\Http\Middleware;

use Illuminate\Routing\Middleware\ThrottleRequests;

/**
 * throttle:N,M з окремим лічильником на кожен маршрут.
 * Стандартний ключ Laravel — лише id людини (чи IP), тож усі throttle-маршрути ділили один лічильник:
 * фонові запити сторінки (віджети, опитування) з’їдали малий ліміт дії на кшталт «5 за 10 хв».
 * Іменовані ліміти (throttle:login тощо) працюють як раніше.
 */
class ThrottlePerRoute extends ThrottleRequests
{
    protected function resolveRequestSignature($request)
    {
        $route = $request->route();
        $scope = $route ? $request->method().'|'.$route->uri() : '';

        return parent::resolveRequestSignature($request).'|'.sha1($scope);
    }
}
