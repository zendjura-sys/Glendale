<?php

namespace App\Http\Controllers;

use App\Enums\AlertType;
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
        $region = null;
        foreach ((array) ($state['regions'] ?? []) as $row) {
            if (is_array($row) && ($row['slug'] ?? null) === $slug) {
                $region = $row;
                break;
            }
        }

        return [
            'active_count' => (int) ($state['active_count'] ?? 0),
            'region' => is_array($region) ? [
                'name' => $region['name'],
                'active' => (bool) $region['active'],
                // Головний вид тривоги (AlertType) і коли почалась — для таймера в стрічці.
                'alert' => $region['alert'] ?? null,
                'label' => is_string($region['alert'] ?? null) ? AlertType::tryFrom($region['alert'])?->label() : null,
                'started_at' => $region['started_at'] ?? null,
            ] : null,
            // Останнє повідомлення моніторингу (ПС ЗСУ / канали) — одним рядком.
            'latest' => is_array($state['feed'][0] ?? null) ? mb_substr((string) ($state['feed'][0]['text'] ?? ''), 0, 200) : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function family(int $userId): ?array
    {
        $member = FamilyMember::query()->with('family.server')->where('user_id', $userId)
            ->where('status', FamilyMember::STATUS_ACTIVE)->first();
        $family = $member?->family;
        if ($member === null || $family === null) {
            return null;
        }

        return [
            'dossier' => $member->dossier(),
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
