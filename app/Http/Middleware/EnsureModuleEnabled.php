<?php

namespace App\Http\Middleware;

use App\Services\Geo\CountryRestrictions;
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

        return $next($request);
    }
}
