<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\User;
use App\Services\Billing\AuthorSubscriptions;
use App\Services\Billing\CommunityPromotion;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\Wallet;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Платні підписки на авторів і просування спільнот — лише сайт, з особистого рахунку. */
class AuthorSubscriptionController extends Controller
{
    public function __construct(private readonly AuthorSubscriptions $subs) {}

    /** Налаштування → «Підписки»: мої рівні й дохід, а також на кого підписаний я. */
    public function settings(Request $request): Response
    {
        app(Plugins::class)->ensure('author_subscriptions');
        $user = $request->user();
        $mine = DB::table('author_subscriptions as s')->join('users as u', 'u.id', '=', 's.author_id')
            ->leftJoin('author_tiers as t', 't.id', '=', 's.tier_id')
            ->where('s.user_id', $user->id)->where('s.expires_at', '>', now())
            ->orderBy('s.expires_at')->get(['u.id', 'u.name', 'u.username', 't.name as tier', 's.price', 's.expires_at', 's.auto_renew']);

        return Inertia::render('settings/subscriptions', [
            'tiers' => $this->subs->tiers($user),
            'earnings' => $this->subs->earnings($user),
            'balance' => (int) $user->balance,
            'subscriptions' => $mine->map(fn ($r) => [
                'author' => ['id' => (int) $r->id, 'name' => $r->name, 'username' => $r->username],
                'tier' => $r->tier, 'price' => (int) $r->price, 'expires_at' => (string) $r->expires_at, 'auto_renew' => (bool) $r->auto_renew,
            ])->values()->all(),
        ]);
    }

    public function saveTiers(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('author_subscriptions');
        $data = $request->validate([
            'tiers' => ['present', 'array', 'max:'.AuthorSubscriptions::MAX_TIERS],
            'tiers.*.id' => ['nullable', 'integer'],
            'tiers.*.name' => ['required', 'string', 'min:2', 'max:40'],
            'tiers.*.price' => ['required', 'integer', 'min:2000', 'max:500000'],
            'tiers.*.perks' => ['nullable', 'string', 'max:300'],
        ], ['tiers.*.price.min' => 'Мінімальна ціна — 20 ₴ на місяць.']);
        $this->subs->saveTiers($request->user(), array_values($data['tiers']));

        return response()->json(['tiers' => $this->subs->tiers($request->user())]);
    }

    /** Рівні автора для діалогу «Підтримати» на сторінці людини. */
    public function tiers(Request $request, User $user): JsonResponse
    {
        app(Plugins::class)->ensure('author_subscriptions');
        $viewer = $request->user();
        $current = DB::table('author_subscriptions')->where('user_id', $viewer->id)->where('author_id', $user->id)->where('expires_at', '>', now())->first();

        return response()->json([
            'tiers' => $this->subs->tiers($user),
            'balance' => (int) $viewer->balance,
            'current' => $current ? ['tier_id' => $current->tier_id ? (int) $current->tier_id : null, 'expires_at' => (string) $current->expires_at, 'auto_renew' => (bool) $current->auto_renew] : null,
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('author_subscriptions');
        $data = $request->validate(['tier_id' => ['required', 'integer']]);
        try {
            $this->subs->subscribe($request->user(), (int) $data['tier_id']);
        } catch (InsufficientFunds) {
            return response()->json(['message' => 'Недостатньо коштів на рахунку — поповніть його в GameCon+.'], 422);
        }

        return response()->json(['ok' => true, 'balance' => (int) $request->user()->fresh()?->balance]);
    }

    public function autoRenew(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['on' => ['required', 'boolean']]);
        $this->subs->setAutoRenew($request->user(), $user->id, (bool) $data['on']);

        return response()->json(['ok' => true]);
    }

    /** Просування спільноти на 7 днів (керівники спільноти). */
    public function promote(Request $request, Community $community, CommunityPromotion $promotion): JsonResponse
    {
        app(Plugins::class)->ensure('community_promotion');
        $user = $request->user();
        abort_unless((bool) $community->membershipFor($user)?->isAdmin() || $user->isStaff(), 403);
        abort_unless($community->is_listed, 422, 'Спершу зробіть спільноту видимою в каталозі.');
        try {
            $promotion->buy($user, $community);
        } catch (InsufficientFunds) {
            return response()->json(['message' => 'Недостатньо коштів на рахунку — поповніть його в GameCon+.'], 422);
        }

        return response()->json(['promoted_until' => $community->fresh()?->promoted_until?->toIso8601String(), 'price' => Wallet::uah($promotion->price())]);
    }
}
