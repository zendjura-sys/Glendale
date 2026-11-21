<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Quality\PageVitals;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Швидкість: p75 LCP / INP / CLS / TTFB за сторінками з реальних відвідувань. */
class VitalsController extends Controller
{
    public function index(Request $request, PageVitals $vitals): Response
    {
        $filters = $request->validate([
            'days' => ['nullable', Rule::in([1, 7, 30])],
            'device' => ['nullable', Rule::in(PageVitals::DEVICES)],
        ]);
        $days = (int) ($filters['days'] ?? 7);
        $device = $filters['device'] ?? null;

        return Inertia::render('admin/vitals', [
            'days' => $days,
            'device' => $device,
            'report' => $vitals->report($days, $device),
        ]);
    }
}
