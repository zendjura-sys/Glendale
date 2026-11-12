<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Analytics\ActivityMetrics;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Метрики: DAU/WAU/MAU, реєстрації, утримання за когортами й топ розділів. */
class MetricsController extends Controller
{
    public function __invoke(ActivityMetrics $metrics): Response
    {
        return Inertia::render('admin/metrics', [
            'report' => Cache::remember('admin.metrics', now()->addMinutes(10), fn () => $metrics->report(30)),
        ]);
    }
}
