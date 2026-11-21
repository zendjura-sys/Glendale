<?php

namespace App\Http\Controllers;

use App\Services\Billing\CosmeticsShop;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\Wallet;
use App\Services\Quests\SeasonPass;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Магазин оформлення (№255): вітрина, покупка за баланс, вдягнути/зняти. Лише сайт. */
class CosmeticsShopController extends Controller
{
    public function index(Request $request, CosmeticsShop $shop): Response
    {
        app(Plugins::class)->ensure('cosmetics_shop');
        $user = $request->user();

        return Inertia::render('shop/index', [
            'items' => $shop->catalog($user),
            'balance' => (int) $user->balance,
        ]);
    }

    public function buy(Request $request, CosmeticsShop $shop): RedirectResponse
    {
        app(Plugins::class)->ensure('cosmetics_shop');
        $data = $request->validate(['key' => ['required', 'string', 'max:40']]);
        try {
            $shop->buy($request->user(), $data['key']);
        } catch (InsufficientFunds $e) {
            throw ValidationException::withMessages(['item' => 'На балансі не вистачає '.Wallet::units($e->shortfall).' — поповніть рахунок у «GameCon+ → Рахунок».']);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Куплено й вдягнуто.']);

        return back();
    }

    public function equip(Request $request, SeasonPass $season): RedirectResponse
    {
        app(Plugins::class)->ensure('cosmetics_shop');
        $data = $request->validate([
            'type' => ['required', Rule::in(SeasonPass::EQUIPPABLE)],
            'value' => ['nullable', 'string', 'max:40'],
        ]);
        $season->equip($request->user(), $data['type'], $data['value'] ?? null);

        return back();
    }
}
