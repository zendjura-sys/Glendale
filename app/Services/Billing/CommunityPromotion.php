<?php

namespace App\Services\Billing;

use App\Models\Community;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Просування спільноти в каталозі за одиниці балансу GameCon: 7 днів угорі «Огляду» з позначкою «Просувається». */
class CommunityPromotion
{
    public const DAYS = 7;

    public function __construct(private readonly Wallet $wallet, private readonly SiteSettings $settings) {}

    public function price(): int
    {
        return max(100, (int) $this->settings->get('community_promo_price', 9900));
    }

    /** @throws InsufficientFunds */
    public function buy(User $payer, Community $community): void
    {
        DB::transaction(function () use ($payer, $community) {
            $this->wallet->debit($payer, $this->price(), 'promo', 'Просування спільноти «'.$community->name.'» на '.self::DAYS.' днів', 'community_promo', 'community:'.$community->id);
            $this->extend($community, self::DAYS);
        });
    }

    public function extend(Community $community, int $days): void
    {
        $from = $community->promoted_until && $community->promoted_until->isFuture() ? Carbon::parse($community->promoted_until) : now();
        $community->forceFill(['promoted_until' => $from->addDays($days)])->save();
    }

    public function stop(Community $community): void
    {
        $community->forceFill(['promoted_until' => null])->save();
    }
}
