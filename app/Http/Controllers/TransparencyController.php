<?php

namespace App\Http\Controllers;

use App\Services\Moderation\TransparencyReport;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Публічний звіт прозорості модерації (доступний і без входу). */
class TransparencyController extends Controller
{
    public function __invoke(Request $request, TransparencyReport $report): Response
    {
        $quarters = $report->quarters();
        $key = (string) $request->query('q', $quarters[0]['key']);

        return Inertia::render('transparency', [
            'quarters' => $quarters,
            'report' => $report->for($key),
        ])->withViewData(['seoTitle' => 'Звіт прозорості GameCon', 'seoDescription' => 'Скарги, рішення модерації, апеляції й боротьба зі спамом на GameCon — щокварталу, відкрито.']);
    }
}
