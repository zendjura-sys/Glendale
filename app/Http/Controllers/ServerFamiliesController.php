<?php

namespace App\Http\Controllers;

use App\Models\GtaServer;
use App\Services\Servers\ServerFamilyRanking;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Сервер → «Рейтинг сімей»: окрема сторінка з періодами, п’єдесталом і таблицею. */
class ServerFamiliesController extends Controller
{
    public function index(Request $request, GtaServer $server, ServerFamilyRanking $ranking): Response
    {
        abort_unless($server->status === GtaServer::STATUS_PUBLISHED || $request->user()?->isAdmin(), 404);
        $period = (string) $request->query('period', 'month');
        $period = array_key_exists($period, ServerFamilyRanking::PERIODS) ? $period : 'month';

        return Inertia::render('servers/families', [
            'server' => $server->toCard(),
            'period' => $period,
            'periods' => ServerFamilyRanking::PERIODS,
            'rows' => $ranking->rows($server, $period),
        ]);
    }
}
