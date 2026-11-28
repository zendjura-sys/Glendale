<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PushDevice;
use App\Models\WebPushSubscription;
use App\Services\Push\FcmClient;
use App\Services\Push\PushStats;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Доставка пушів: за 14 днів — надіслано, помилки, мертві токени, прострочені тривоги; за видами. */
class PushStatsController extends Controller
{
    public function index(FcmClient $fcm): Response
    {
        return Inertia::render('admin/push-stats', [
            ...PushStats::report(14),
            'devices' => [
                'app' => PushDevice::query()->count(),
                'app_active' => PushDevice::query()->where('last_used_at', '>=', now()->subDays(30))->count(),
                'web' => WebPushSubscription::query()->count(),
            ],
            'fcm' => $fcm->configured(),
        ]);
    }
}
