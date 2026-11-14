<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AirAlertNotice;
use App\Services\Alerts\AlertWatcher;
use App\Services\Alerts\UkraineAlarm;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка → Тривоги: чи живий опитувач UkraineAlarm і вебхук, що триває зараз, хто підписаний
 * і скільки сповіщень розіслано. «Перевірити зараз» і дії з вебхуком пишуться в журнал.
 */
class AlertsController extends Controller
{
    public function index(UkraineAlarm $api, AlertWatcher $watcher): Response
    {
        $enabled = $api->enabled();
        $tree = $enabled ? $api->regions() : [];
        $active = $enabled ? ($api->active(false) ?? []) : [];

        // Що триває зараз: місце → типи; найдовші тривоги вгорі.
        $now = [];
        $byType = [];
        foreach ($active as $id => $types) {
            foreach ($types as $type => $since) {
                $byType[$type] = ($byType[$type] ?? 0) + 1;
            }
            $node = $tree[$id] ?? null;
            $now[] = [
                'id' => (string) $id,
                'name' => $node['name'] ?? (string) $id,
                'type_label' => $node !== null ? UkraineAlarm::typeLabel($node['type']) : null,
                'path' => $node !== null ? $api->pathLabel((string) $id) : null,
                'alerts' => array_map(fn (string $type, ?string $since) => [
                    'type' => $type,
                    'name' => UkraineAlarm::TYPES[$type][0] ?? $type,
                    'since' => $since,
                    'level' => $type === 'AIR' ? ($api->levelFor((string) $id, 'AIR') ?? 'red') : null,
                    'accent' => UkraineAlarm::accent($type, $type === 'AIR' ? ($api->levelFor((string) $id, 'AIR') ?? 'red') : 'red'),
                ], array_keys($types), array_values($types)),
            ];
        }
        usort($now, fn ($a, $b) => strcmp((string) ($a['alerts'][0]['since'] ?? ''), (string) ($b['alerts'][0]['since'] ?? '')));

        $notices = DB::table('notifications')->where('type', AirAlertNotice::class);
        $tick = Cache::get('ua_alarm_at');

        return Inertia::render('admin/alerts', [
            'enabled' => $enabled,
            'health' => [
                'tick_at' => is_int($tick) ? date(DATE_ATOM, $tick) : null,
                'tick_fresh' => is_int($tick) && time() - $tick <= AlertWatcher::FRESH,
                'index' => Cache::get(AlertWatcher::INDEX),
                'webhook_url' => $api->webhookUrl(),
                'webhook_ok' => $this->stamp(Cache::get('ua_alarm:webhook_ok')),
                'webhook_rejected' => $this->stamp(Cache::get('ua_alarm:webhook_rejected')),
                'regions' => count($tree),
            ],
            'now' => array_slice($now, 0, 60),
            'now_total' => count($now),
            'by_type' => collect($byType)->map(fn (int $count, string $type) => ['type' => $type, 'name' => UkraineAlarm::TYPES[$type][0] ?? $type, 'count' => $count, 'accent' => UkraineAlarm::accent($type)])->values(),
            'subscribers' => $this->subscribers($api, $watcher),
            'sent' => [
                'day' => (clone $notices)->where('created_at', '>=', now()->subDay())->count(),
                'week' => (clone $notices)->where('created_at', '>=', now()->subWeek())->count(),
                'ended_day' => (clone $notices)->where('created_at', '>=', now()->subDay())->where('data', 'like', '%"kind":"air_alert_end"%')->count(),
            ],
            'recent' => $this->recent(),
        ]);
    }

    /** «Перевірити зараз»: один прохід опитувача поза розкладом (стан однаково з API). */
    public function check(Request $request, AlertWatcher $watcher): RedirectResponse
    {
        $sent = $watcher->run(force: true);
        Log::info('admin.alerts.check', ['by' => $request->user()->id, 'sent' => $sent]);

        return back()->with('success', "Перевірено. Надіслано сповіщень: {$sent}.");
    }

    /** Зареєструвати, оновити чи прибрати вебхук на боці UkraineAlarm (те саме, що alerts:webhook). */
    public function webhook(Request $request, UkraineAlarm $api): RedirectResponse
    {
        $action = $request->validate(['action' => ['required', 'in:register,update,delete']])['action'];
        $ok = match ($action) {
            'register' => $api->registerWebhook(),
            'update' => $api->registerWebhook(update: true),
            'delete' => $api->deleteWebhook(),
        };
        Log::info('admin.alerts.webhook', ['by' => $request->user()->id, 'action' => $action, 'ok' => $ok]);

        return back()->with($ok ? 'success' : 'error', $ok ? 'Готово.' : 'UkraineAlarm відхилив запит — перевірте ключ в інтеграціях і журнал.');
    }

    /** @return array{total: int, push: int, places: int, top: list<array{id: string, name: string, path: string|null, count: int}>} */
    private function subscribers(UkraineAlarm $api, AlertWatcher $watcher): array
    {
        return Cache::remember('admin:alerts:subscribers', 300, function () use ($api, $watcher) {
            $total = 0;
            $push = 0;
            $places = 0;
            $units = [];
            User::query()->where(fn ($q) => $q->whereNotNull('preferences->alert_region')->orWhereNotNull('preferences->alert_unit')->orWhereNotNull('preferences->alert_places'))
                ->select(['id', 'preferences'])
                ->chunkById(500, function ($users) use (&$total, &$push, &$places, &$units, $api, $watcher) {
                    foreach ($users as $user) {
                        $total++;
                        if (AlertWatcher::prefsOf($user)['push']) {
                            $push++;
                        }
                        $places += count(AlertWatcher::placesOf($user));
                        if ($api->enabled() && ($unit = $watcher->unitFor($user)) !== null) {
                            $units[$unit] = ($units[$unit] ?? 0) + 1;
                        }
                    }
                });
            arsort($units);
            $tree = $api->enabled() ? $api->regions() : [];
            $top = [];
            foreach (array_slice($units, 0, 10, true) as $id => $count) {
                $top[] = ['id' => (string) $id, 'name' => $tree[$id]['name'] ?? (string) $id, 'path' => isset($tree[$id]) ? $api->pathLabel((string) $id) : null, 'count' => $count];
            }

            return ['total' => $total, 'push' => $push, 'places' => $places, 'top' => $top];
        });
    }

    /** Останні тривоги й відбої: одна подія (alert_key + статус) — скільки людей отримали. */
    private function recent(): array
    {
        return DB::table('notifications')->where('type', AirAlertNotice::class)
            ->where('created_at', '>=', now()->subDays(2))
            ->orderByDesc('created_at')->limit(400)->get(['data', 'created_at'])
            ->map(fn (object $row) => [...(json_decode((string) $row->data, true) ?: []), 'at' => $row->created_at])
            ->groupBy(fn (array $d) => ($d['alert_key'] ?? '').'|'.($d['kind'] ?? ''))
            ->map(fn ($rows) => [
                'kind' => $rows[0]['kind'] ?? 'air_alert',
                'text' => preg_replace('/^.+? — /u', '', (string) ($rows[0]['text'] ?? '')),
                'region' => $rows[0]['region'] ?? null,
                'accent' => $rows[0]['accent'] ?? null,
                'at' => $rows[0]['at'],
                'users' => $rows->count(),
            ])
            ->values()->take(20)->all();
    }

    private function stamp(mixed $value): ?array
    {
        return is_array($value) && is_int($value['at'] ?? null) ? ['at' => date(DATE_ATOM, $value['at']), 'reason' => $value['reason'] ?? null] : null;
    }
}
