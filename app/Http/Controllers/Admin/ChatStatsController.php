<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Antispam\ChatStats;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Статистика чатів. */
class ChatStatsController extends Controller
{
    public function index(ChatStats $stats): Response
    {
        return Inertia::render('admin/chat-stats', $stats->overview());
    }
}
