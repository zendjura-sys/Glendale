<?php

namespace App\Http\Middleware;

use App\Support\Settings\SiteSettings;
use Closure;
use Illuminate\Auth\Middleware\EnsureEmailIsVerified;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Вимагає підтверджену пошту, лише якщо це ввімкнено в налаштуваннях сайту.
 */
class EnsureEmailVerifiedWhenRequired
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->settings->get('email_verification')) {
            return $next($request);
        }

        return app(EnsureEmailIsVerified::class)->handle($request, $next);
    }
}
