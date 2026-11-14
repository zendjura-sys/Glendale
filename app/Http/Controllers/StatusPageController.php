<?php

namespace App\Http\Controllers;

use App\Models\StatusIncident;
use App\Services\Status\HealthChecks;
use App\Support\Plugins\Plugins;
use Inertia\Inertia;
use Inertia\Response;

/** Публічна сторінка статусу: чи все працює, активні інциденти й історія за 30 днів. */
class StatusPageController extends Controller
{
    public function __invoke(HealthChecks $health): Response
    {
        app(Plugins::class)->ensure('status_page');
        $incidents = StatusIncident::query()
            ->where(fn ($q) => $q->where('status', '!=', 'resolved')->orWhere('resolved_at', '>=', now()->subDays(30)))
            ->orderByRaw("case when status = 'resolved' then 1 else 0 end")
            ->orderByDesc('started_at')
            ->limit(30)
            ->get();

        return Inertia::render('status', [
            'overall' => $health->overall(),
            'components' => $health->components(),
            'active' => $incidents->where('status', '!=', 'resolved')->values()->map->toCard(),
            'history' => $incidents->where('status', 'resolved')->values()->map->toCard(),
            'checked_at' => now()->toIso8601String(),
        ])->withViewData(['seoTitle' => 'Статус GameCon', 'seoDescription' => 'Чи працюють сайт, застосунок, повідомлення й музика GameCon просто зараз.']);
    }

    /**
     * Активний інцидент для банера сайту й застосунку (кеш на хвилину).
     *
     * @return array{id: int, title: string, severity: string, status: string}|null
     */
    public static function banner(): ?array
    {
        if (! app(Plugins::class)->on('status_page')) {
            return null;
        }

        return cache()->remember('status:banner', 60, function () {
            $incident = StatusIncident::query()->where('status', '!=', 'resolved')->orderByDesc('severity')->latest('started_at')->first();

            return $incident === null ? null : ['id' => $incident->id, 'title' => $incident->title, 'severity' => $incident->severity, 'status' => $incident->status];
        });
    }
}
