<?php

namespace App\Console\Commands;

use App\Models\PaymentOrder;
use App\Models\PlusRenewal;
use App\Services\Billing\Checkout;
use App\Services\Billing\Shop;
use Illuminate\Console\Command;

/**
 * Щогодини: автопродовження GameCon+ (залишком старого балансу або збереженою карткою) і перевірка замовлень,
 * за якими не прийшов вебхук monobank; прострочені неоплачені замовлення закриваються.
 */
class BillingTick extends Command
{
    protected $signature = 'billing:tick';

    protected $description = 'Автопродовження GameCon+ і перевірка оплат monobank';

    public function handle(Shop $shop, Checkout $checkout): int
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

        if ($renewed > 0 || $expired > 0) {
            $this->info("Продовжено: {$renewed}, закрито замовлень: {$expired}");
        }

        return self::SUCCESS;
    }
}
