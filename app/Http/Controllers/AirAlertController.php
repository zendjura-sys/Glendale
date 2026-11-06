<?php

namespace App\Http\Controllers;

use App\Services\Alerts\AirAlertService;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Мапа тривог і радар цілей — лише для людей з України (за IP, профілем чи обраною областю). */
class AirAlertController extends Controller
{
    /** Скільки годин тримається статус «В укритті», якщо не зняти раніше. */
    public const SHELTER_HOURS = 3;

    public function __construct(private readonly AirAlertService $alerts) {}

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
        ]);
        $user = $request->user();
        $patch = [];
        if (array_key_exists('region', $data)) {
            $patch['alert_region'] = $data['region'];
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
     * @return array{region: string|null, push: bool, shelter: bool}
     */
    private function prefs(Request $request): array
    {
        $user = $request->user();
        $region = $user->pref('alert_region');

        return [
            'region' => is_string($region) ? $region : null,
            'push' => $user->pref('alert_push', true) !== false,
            'shelter' => $user->status_emoji === '🛡️' && ($user->status_until === null || $user->status_until->isFuture()),
        ];
    }

    private function ensure(Request $request): void
    {
        app(Plugins::class)->ensure('air_alerts');
        abort_unless($this->alerts->isAvailableFor($request), 404);
    }
}
