<?php

namespace App\Http\Controllers;

use App\Models\FamilyItem;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Services\Alerts\AirAlertService;
use App\Support\Modules\ModuleManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Меню «Bento Hub» (телефон на сайті й застосунок): інформер тривог і штаб сім'ї —
 * казна, склад (що закінчується) й звіти на перевірці. Лише читання.
 */
class HubController extends Controller
{
    public function __invoke(Request $request, ModuleManager $modules): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'alerts' => $this->alerts($request),
            'family' => $modules->enabled('families') ? $this->family($user->id) : null,
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function alerts(Request $request): ?array
    {
        $service = app(AirAlertService::class);
        if (! $service->isAvailableFor($request)) {
            return null;
        }
        try {
            $state = $service->state();
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
        $slug = $request->user()?->pref('alert_region');
        $region = collect($state['regions'] ?? [])->firstWhere('slug', $slug);

        return [
            'active_count' => (int) ($state['active_count'] ?? 0),
            'region' => is_array($region) ? ['name' => $region['name'], 'active' => (bool) $region['active']] : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function family(int $userId): ?array
    {
        $family = FamilyMember::query()->with('family')->where('user_id', $userId)
            ->where('status', FamilyMember::STATUS_ACTIVE)->first()?->family;
        if ($family === null) {
            return null;
        }

        return [
            'name' => $family->name,
            'slug' => $family->slug,
            'treasury' => (int) $family->treasury,
            'items' => FamilyItem::query()->where('family_id', $family->id)->count(),
            'low_stock' => FamilyItem::query()->where('family_id', $family->id)
                ->whereNotNull('min_stock')->whereColumn('quantity', '<', 'min_stock')->count(),
            'pending_reports' => FamilyReport::query()->where('family_id', $family->id)
                ->where('status', FamilyReport::STATUS_PENDING)->count(),
        ];
    }
}
