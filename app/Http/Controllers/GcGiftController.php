<?php

namespace App\Http\Controllers;

use App\Models\GcGiftPack;
use App\Models\LiveShow;
use App\Models\User;
use App\Models\UserGcGift;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\Wallet;
use App\Services\Shows\GiftPacks;
use App\Support\Plugins\Plugins;
use App\Support\Shows\GiftRarities;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Магазин паків, інвентар, лайки й дарування в GameCast.
 */
class GcGiftController extends Controller
{
    public function __construct(private readonly GiftPacks $gifts) {}

    public function shop(Request $request): JsonResponse|Response
    {
        app(Plugins::class)->ensure('live_shows');
        $data = [
            'packs' => $this->gifts->shop(),
            'inventory' => $this->gifts->inventory($request->user()),
            'balance' => (int) $request->user()->balance,
            'rarities' => array_values(GiftRarities::catalog()),
        ];

        return $request->expectsJson()
            ? response()->json($data)
            : Inertia::render('shows/gift-shop', $data);
    }

    public function buy(Request $request, GcGiftPack $pack): JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');
        try {
            return response()->json($this->gifts->buy($request->user(), $pack));
        } catch (InsufficientFunds $e) {
            return response()->json(['message' => 'Недостатньо коштів на балансі. Потрібно ще '.Wallet::units($e->shortfall).'.'], 422);
        }
    }

    public function like(Request $request, LiveShow $show, User $user): JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');
        $result = $this->gifts->toggleLike($show, $request->user(), $user);

        return response()->json($result);
    }

    public function gift(Request $request, LiveShow $show, User $user): JsonResponse
    {
        app(Plugins::class)->ensure('live_shows');
        $data = $request->validate([
            'user_gift_id' => ['required', 'integer'],
        ]);
        $owned = UserGcGift::query()->whereKey($data['user_gift_id'])->firstOrFail();
        $sent = $this->gifts->sendGift($show, $request->user(), $user, $owned);

        return response()->json([
            'gift' => $sent->toCard(),
            'inventory' => $this->gifts->inventory($request->user()),
        ]);
    }
}
