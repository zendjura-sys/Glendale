<?php

namespace App\Console\Commands;

use App\Models\PaymentOrder;
use App\Models\PlusRenewal;
use App\Models\PlusSubscription;
use App\Services\Billing\Checkout;
use App\Services\Billing\GooglePlay;
use App\Services\Billing\GooglePlayException;
use App\Services\Billing\Shop;
use Illuminate\Console\Command;

/**
 * Щогодини: автопродовження GameCon+ (залишком старого балансу або збереженою карткою) і перевірка замовлень,
 * за якими не прийшов вебхук monobank; прострочені неоплачені замовлення закриваються. Підписки Google Play,
 * у яких закінчується період, перечитуються з Google (якщо сповіщення RTDN загубилося).
 */
class BillingTick extends Command
{
    protected $signature = 'billing:tick';

    protected $description = 'Автопродовження GameCon+ і перевірка оплат monobank';

    public function handle(Shop $shop, Checkout $checkout, GooglePlay $play): int
    {
        $renewed = 0;
        PlusRenewal::query()->with(['user', 'card'])->where('active', true)->orderBy('id')
            ->each(function (PlusRenewal $renewal) use ($shop, &$renewed) {
                $renewed += $shop->renew($renewal) ? 1 : 0;
            });

        // Вебхук міг загубитися — питаємо банк про свіжі неоплачені замовлення.
        PaymentOrder::query()->where('status', PaymentOrder::PENDING)->whereNotNull('invoice_id')
            ->where('created_at', '>=', now()->subDays(2))->orderBy('id')->limit(200)->get()
            ->each(fn (PaymentOrder $order) => $checkout->sync($order));

        $expired = PaymentOrder::query()->where('status', PaymentOrder::PENDING)->where('expires_at', '<', now())
            ->update(['status' => PaymentOrder::CANCELLED, 'failure' => 'Час на оплату минув.']);

        if ($play->credentials() !== null) {
            PlusSubscription::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->whereNotNull('purchase_token')
                ->whereNotIn('status', ['expired'])
                ->where(fn ($q) => $q->where('renews_at', '<', now()->addDay())->orWhereNull('acknowledged_at'))
                ->where(fn ($q) => $q->whereNull('checked_at')->orWhere('checked_at', '<', now()->subHours(6)))
                ->orderBy('id')->limit(200)->get()
                ->each(function (PlusSubscription $subscription) use ($play) {
                    try {
                        $play->sync((string) $subscription->purchase_token);
                    } catch (GooglePlayException) {
                        $subscription->update(['checked_at' => now()]);
                    }
                });
        }

        if ($renewed > 0 || $expired > 0) {
            $this->info("Продовжено: {$renewed}, закрито замовлень: {$expired}");
        }

        return self::SUCCESS;
    }
}
