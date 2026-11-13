<?php

namespace App\Http\Controllers;

use App\Services\Alerts\AirAlertService;
use App\Services\Alerts\AlertWatcher;
use App\Services\Alerts\UkraineAlarm;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Мапа тривог і радар цілей — лише для людей з України (за IP, профілем чи обраною областю). */
class AirAlertController extends Controller
{
    /** Скільки годин тримається статус «В укритті», якщо не зняти раніше. */
    public const SHELTER_HOURS = 3;

    public function __construct(private readonly AirAlertService $alerts, private readonly UkraineAlarm $api) {}

    public function index(Request $request): Response
    {
        $this->ensure($request);

        return Inertia::render('alerts/index', [
            'state' => $this->alerts->state(),
            'prefs' => $this->prefs($request),
            'regions' => $this->regionList(),
            'sources' => $this->alerts->sources(),
        ]);
    }

    /**
     * Райони й громади області (довідник UkraineAlarm) — для вибору місця сповіщень.
     */
    public function units(Request $request): JsonResponse
    {
        $this->ensure($request);
        $data = $request->validate(['region' => ['required', Rule::in(array_keys(AirAlertService::REGIONS))]]);

        return response()->json(['enabled' => $this->api->enabled(), 'districts' => $this->api->enabled() ? $this->api->unitsOf($data['region']) : []]);
    }

    /** @return list<array{slug: string, name: string}> */
    private function regionList(): array
    {
        $list = [];
        foreach (AirAlertService::REGIONS as $slug => $region) {
            $list[] = ['slug' => $slug, 'name' => $region['name']];
        }

        return $list;
    }

    public function state(Request $request): JsonResponse
    {
        $this->ensure($request);

        // ?full=1 — один раз при відкритті екрана в застосунку: ще список областей і джерел.
        $full = $request->boolean('full') ? ['region_list' => $this->regionList(), 'sources' => $this->alerts->sources()] : [];

        return response()->json([...$this->alerts->state(), 'prefs' => $this->prefs($request), ...$full]);
    }

    /** Своя область, пуші про тривогу й швидкий статус «🛡️ В укритті». */
    public function preferences(Request $request): JsonResponse
    {
        $this->ensure($request);
        $data = $request->validate([
            'region' => ['sometimes', 'nullable', Rule::in(array_keys(AirAlertService::REGIONS))],
            'push' => ['sometimes', 'boolean'],
            'shelter' => ['sometimes', 'boolean'],
            // Район чи громада з довідника UkraineAlarm; null — уся область.
            'unit' => ['sometimes', 'nullable', 'string', 'max:20'],
            // Фільтри: початок, відбій, червоні, жовті тривоги; беззвучно — лише рядок у дзвіночку.
            'start' => ['sometimes', 'boolean'],
            'end' => ['sometimes', 'boolean'],
            'red' => ['sometimes', 'boolean'],
            'yellow' => ['sometimes', 'boolean'],
            'silent' => ['sometimes', 'boolean'],
        ]);
        $user = $request->user();
        $patch = [];
        if (array_key_exists('region', $data)) {
            $patch['alert_region'] = $data['region'];
            // Інша область — район і громада скидаються.
            if ($data['region'] !== $user->pref('alert_region')) {
                $patch['alert_unit'] = null;
            }
        }
        if (array_key_exists('unit', $data)) {
            $unit = $data['unit'];
            if ($unit !== null) {
                $known = $this->api->regions()[$unit] ?? null;
                $state = $known !== null ? $this->api->regions()[$known['state']] ?? null : null;
                if ($known === null || $state === null) {
                    throw ValidationException::withMessages(['unit' => 'Такого району чи громади немає в довіднику.']);
                }
                // Область підлаштовується під обране місце.
                $patch['alert_region'] = $this->alerts->slugFor($state['name']) ?? $user->pref('alert_region');
            }
            $patch['alert_unit'] = $unit;
        }
        foreach (['start', 'end', 'red', 'yellow', 'silent'] as $flag) {
            if (array_key_exists($flag, $data)) {
                $patch['alert_'.$flag] = (bool) $data[$flag];
            }
        }
        if (array_key_exists('push', $data)) {
            $patch['alert_push'] = (bool) $data['push'];
        }
        if ($patch !== []) {
            $user->mergePref($patch);
        }
        if (array_key_exists('shelter', $data)) {
            if ($data['shelter']) {
                $user->forceFill(['status_emoji' => '🛡️', 'status' => 'В укритті (тривога)', 'status_until' => now()->addHours(self::SHELTER_HOURS)])->save();
                $user->mergePref(['shelter_since' => now()->toIso8601String()]);
            } else {
                // Знімаємо лише свій статус «В укритті», не чужий власний.
                if ($user->status_emoji === '🛡️') {
                    $user->forceFill(['status_emoji' => null, 'status' => null, 'status_until' => null])->save();
                }
                $user->mergePref(['shelter_since' => null]);
            }
            Cache::forget('presence.'.$user->id);
        }

        return response()->json(['ok' => true, 'prefs' => $this->prefs($request)]);
    }

    /**
     * @return array{region: string|null, unit: array{id: string, name: string, type: string}|null, units_enabled: bool, push: bool, start: bool, end: bool, red: bool, yellow: bool, silent: bool, shelter: bool}
     */
    private function prefs(Request $request): array
    {
        $user = $request->user();
        $region = $user->pref('alert_region');
        $unit = $user->pref('alert_unit');
        $known = is_string($unit) && $this->api->enabled() ? ($this->api->regions()[$unit] ?? null) : null;

        return [
            'region' => is_string($region) ? $region : null,
            'unit' => $known !== null ? ['id' => $known['id'], 'name' => $known['name'], 'type' => $known['type']] : null,
            'units_enabled' => $this->api->enabled(),
            ...AlertWatcher::prefsOf($user),
            'shelter' => $user->status_emoji === '🛡️' && ($user->status_until === null || $user->status_until->isFuture()),
        ];
    }

    private function ensure(Request $request): void
    {
        app(Plugins::class)->ensure('air_alerts');
        abort_unless($this->alerts->isAvailableFor($request), 404);
    }
}
