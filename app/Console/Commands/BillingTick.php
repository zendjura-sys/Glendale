<?php

namespace App\Console\Commands;

use App\Models\PlusRenewal;
use App\Models\WalletTopup;
use App\Services\Billing\Shop;
use Illuminate\Console\Command;

/**
 * Щогодини: автопродовження GameCon+ з рахунку (за добу до кінця періоду) і закриття прострочених заявок
 * на поповнення, за якими людина так і не натиснула «Я оплатив».
 */
class BillingTick extends Command
{
    protected $signature = 'billing:tick';

    protected $description = 'Автопродовження GameCon+ з рахунку й закриття прострочених заявок';

    public function handle(Shop $shop): int
    {
        $renewed = 0;
        PlusRenewal::query()->with('user')->where('active', true)->orderBy('id')
            ->each(function (PlusRenewal $renewal) use ($shop, &$renewed) {
                $renewed += $shop->renew($renewal) ? 1 : 0;
            });

        $expired = WalletTopup::query()->where('status', WalletTopup::PENDING)->whereNull('claimed_at')
            ->where('expires_at', '<', now())->update(['status' => WalletTopup::CANCELLED]);

        if ($renewed > 0 || $expired > 0) {
            $this->info("Продовжено: {$renewed}, закрито заявок: {$expired}");
        }

        return self::SUCCESS;
    }
}
