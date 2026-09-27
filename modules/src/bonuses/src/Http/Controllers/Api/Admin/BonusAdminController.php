<?php

namespace Addons\Bonuses\Http\Controllers\Api\Admin;

use Addons\Bonuses\Models\BankTransfer;
use Addons\Bonuses\Models\BonusPayout;
use Addons\Bonuses\Models\BonusSettings;
use Addons\Bonuses\Models\CashRequest;
use Addons\Bonuses\Models\InvestmentAchievementTier;
use Addons\Bonuses\Models\ManualBonusAward;
use Addons\Bonuses\Support\FinanceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON-двійник Admin\BonusAdminController для мобільної адмінки.
 * Одноклікові дії (reverseTransfer/completeCashRequest/cancelCashRequest/
 * markPaid/runNow/searchMembers) уже повертають чистий JSON на
 * веб-стороні (той самий контракт, що й тут) — маршрути /api нижче
 * просто вказують напряму на Admin\BonusAdminController для них, без
 * дублювання. Тут лишились тільки форми, які на сайті йдуть через
 * Inertia-редірект (RedirectResponse) — мобільному клієнту потрібна
 * JSON-відповідь, тож для них окремі, аналогічні за логікою методи.
 */
class BonusAdminController
{
    public function indexJson(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'message' => null,
            'data' => [
                'settings' => BonusSettings::current(),
                'tiers' => InvestmentAchievementTier::query()
                    ->orderBy('sort_order')->orderBy('threshold_amount')->get(),
                'payouts' => BonusPayout::query()
                    ->with('user:id,name')
                    ->orderByDesc('week_start')
                    ->orderByDesc('total_amount')
                    ->limit(50)
                    ->get(),
                'manualAwards' => ManualBonusAward::query()
                    ->with(['user:id,name', 'awardedBy:id,name'])
                    ->latest()
                    ->limit(30)
                    ->get(),
                'transfers' => BankTransfer::query()
                    ->with(['sender:id,name', 'recipient:id,name', 'reversedBy:id,name'])
                    ->latest()
                    ->limit(30)
                    ->get(),
                'cashRequests' => CashRequest::query()
                    ->with(['user:id,name', 'resolvedBy:id,name'])
                    ->latest()
                    ->limit(30)
                    ->get(),
            ],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function storeManualAward(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $award = ManualBonusAward::create([
            ...$data,
            'awarded_by' => $request->user()->id,
        ])->load(['user:id,name', 'awardedBy:id,name']);
        FinanceNotifier::manualAwardGranted($award, $request->user());

        return response()->json([
            'ok' => true,
            'message' => 'Премію видано.',
            'data' => ['award' => $award],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function destroyManualAward(ManualBonusAward $manualAward): JsonResponse
    {
        $manualAward->delete();
        FinanceNotifier::manualAwardRevoked($manualAward, request()->user());

        return response()->json(['ok' => true, 'message' => 'Запис видалено.', 'data' => null, 'errors' => null, 'redirect' => null]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bizwar_base_rate' => ['required', 'integer', 'min:0'],
            'contract_light_rate' => ['required', 'integer', 'min:0'],
            'contract_medium_rate' => ['required', 'integer', 'min:0'],
            'contract_heavy_rate' => ['required', 'integer', 'min:0'],
            'streak_threshold' => ['nullable', 'integer', 'min:1'],
            'streak_bonus_amount' => ['required', 'integer', 'min:0'],
            'contracts_count_threshold' => ['nullable', 'integer', 'min:1'],
            'contracts_count_bonus_amount' => ['required', 'integer', 'min:0'],
            'min_digest_amount' => ['sometimes', 'integer', 'min:0'],
        ]);

        $settings = BonusSettings::current();
        $settings->update($data);

        return response()->json([
            'ok' => true,
            'message' => 'Налаштування премій збережено.',
            'data' => ['settings' => $settings->fresh()],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function updateBankSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transfer_enabled' => ['required', 'boolean'],
            'transfer_daily_limit' => ['nullable', 'integer', 'min:1'],
            'transfer_min_amount' => ['required', 'integer', 'min:1'],
            'deposit_enabled' => ['required', 'boolean'],
            'deposit_interest_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'deposit_min_amount' => ['required', 'integer', 'min:1'],
            'deposit_term_days' => ['required', 'integer', 'min:1'],
        ]);

        $settings = BonusSettings::current();
        $settings->update($data);

        return response()->json([
            'ok' => true,
            'message' => 'Налаштування банку збережено.',
            'data' => ['settings' => $settings->fresh()],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function storeTier(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'threshold_amount' => ['required', 'integer', 'min:1'],
            'bonus_amount' => ['required', 'integer', 'min:0'],
        ]);

        $tier = InvestmentAchievementTier::create([
            ...$data,
            'sort_order' => (int) InvestmentAchievementTier::max('sort_order') + 1,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Тір додано.',
            'data' => ['tier' => $tier],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function destroyTier(InvestmentAchievementTier $tier): JsonResponse
    {
        $tier->delete();

        return response()->json(['ok' => true, 'message' => 'Тір видалено.', 'data' => null, 'errors' => null, 'redirect' => null]);
    }
}
