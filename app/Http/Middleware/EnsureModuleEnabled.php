<?php

namespace App\Http\Middleware;

use App\Services\Geo\CountryRestrictions;
use App\Support\Maintenance;
use App\Support\Modules\ModuleManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleEnabled
{
    public function __construct(private readonly ModuleManager $modules) {}

    public function handle(Request $request, Closure $next, string $module): Response
    {
        // Розділ працює, але закритий для країни відвідувача — пояснюємо, а не «не знайдено».
        if ($this->modules->blockedByCountry($module)) {
            abort(403, CountryRestrictions::MESSAGE);
        }
        abort_unless($this->modules->enabled($module), 404);
        // Техроботи в розділі: команда (адміністрація й модератори) заходить, решта бачить пояснення.
        $notice = Maintenance::message($module);
        if ($notice !== null && ! $request->user()?->isStaff()) {
            abort(503, $notice);
        }

        return $next($request);
    }
}
