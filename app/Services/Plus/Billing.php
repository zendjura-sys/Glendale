<?php

namespace App\Services\Plus;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\ServerPromotion;
use App\Models\User;
use App\Notifications\PlusGifted;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Laravel\Paddle\Subscription;
use Laravel\Paddle\Transaction;

/**
 * Події Paddle (через Cashier) → GameCon+, подарунки, просування серверів, повернення коштів.
 *
 * Cashier сам перевіряє підпис вебхука й веде таблиці customers/subscriptions/transactions;
 * тут — лише наша бізнес-логіка. Кожен обробник безпечний для повтору.
 */
class Billing
{
    public function __construct(
        private readonly Plus $plus,
        private readonly Paddle $paddle,
        private readonly ServerPromotions $promotions,
    ) {}

    /**
     * Підписка створена / оновлена / призупинена / скасована → період GameCon+ власника.
     *
     * Тип підписки: «default» — особистий GameCon+ платника, «family:{id}» — сім’я, яку оплачує лідер.
     *
     * @param  array<string, mixed>  $payload
     */
    public function subscription(Subscription $subscription, array $payload): void
    {
        $owner = $this->subscriptionOwner($subscription);
        if ($owner === null) {
            return;
        }

        $this->plus->syncSubscription($owner, $subscription->id, self::user($subscription->billable), $subscription->created_at, $this->accessEnd($subscription, $payload));
    }

    /**
     * Оплачена транзакція: запис в історії, а для разових товарів — подарунок або просування.
     * Продовження підписок теж приходять сюди — вони лише потрапляють в історію оплат.
     *
     * @param  array<string, mixed>  $payload
     */
    public function transaction(Transaction $transaction, array $payload): void
    {
        $data = (array) ($payload['data'] ?? []);
        $custom = (array) ($data['custom_data'] ?? []);
        $price = data_get($data, 'items.0.price.id');
        $product = $this->paddle->productForPrice(is_string($price) ? $price : null)
            ?? (is_string($custom['product'] ?? null) && array_key_exists($custom['product'], (array) config('plus.products')) ? $custom['product'] : null);
        if ($product === null) {
            return;
        }
        $meta = (array) config("plus.products.{$product}");
        $payer = self::user($transaction->billable);

        DB::transaction(function () use ($transaction, $custom, $product, $meta, $payer) {
            $target = $this->target((string) ($meta['kind'] ?? ''), $custom, $payer);
            $payment = PlusPayment::query()->firstOrCreate(
                ['provider' => Paddle::PROVIDER, 'provider_id' => $transaction->paddle_id],
                [
                    'user_id' => $payer?->id,
                    'product' => $product,
                    'target_type' => match (true) {
                        $target instanceof GtaServer => 'server',
                        $target instanceof Family => 'family',
                        $target instanceof User => 'user',
                        default => null,
                    },
                    'target_id' => $target?->id,
                    'amount' => (int) $transaction->total,
                    'currency' => (string) $transaction->currency,
                    'status' => PlusPayment::PAID,
                    'receipt_url' => null,
                ],
            );
            if (! $payment->wasRecentlyCreated) {
                return;
            }

            $days = (int) ($meta['days'] ?? 0);
            if (($meta['kind'] ?? null) === 'gift' && $target instanceof User) {
                $this->plus->grant($target, $days, 'gift', $payer, $payer?->name, $payment->id);
                if ($payer !== null && $payer->id !== $target->id) {
                    $target->notify(new PlusGifted($payer, $days));
                }
            }
            if (($meta['kind'] ?? null) === 'promo' && $target instanceof GtaServer) {
                $this->promotions->start($target, (string) $meta['promo'], $days, $payer, $payment->id);
            }
        });
    }

    /**
     * Повернення коштів (Paddle adjustment з action=refund, статус approved):
     * платіж позначається поверненим, подарунок і просування знімаються.
     *
     * @param  array<string, mixed>  $payload
     */
    public function adjustment(array $payload): void
    {
        $data = (array) ($payload['data'] ?? []);
        if (($data['action'] ?? null) !== 'refund' || ($data['status'] ?? null) !== 'approved') {
            return;
        }
        $payment = PlusPayment::query()->where('provider', Paddle::PROVIDER)->where('provider_id', (string) ($data['transaction_id'] ?? ''))->first();
        if ($payment === null || $payment->status === PlusPayment::REFUNDED) {
            return;
        }

        $payment->update(['status' => PlusPayment::REFUNDED]);
        foreach (PlusGrant::query()->where('payment_id', $payment->id)->get() as $grant) {
            $this->plus->revoke($grant);
        }
        ServerPromotion::query()->where('payment_id', $payment->id)->update(['ends_at' => now()]);
    }

    /**
     * До коли діє доступ за підпискою:
     *  — активна / пробна / борг за оплату — кінець поточного оплаченого періоду + запас;
     *  — заплановане скасування — дата скасування (доступ до кінця оплаченого);
     *  — скасована чи призупинена — уже ні.
     *
     * @param  array<string, mixed>  $payload
     */
    private function accessEnd(Subscription $subscription, array $payload): CarbonInterface
    {
        $data = (array) ($payload['data'] ?? []);
        if (in_array($subscription->status, [Subscription::STATUS_CANCELED, Subscription::STATUS_PAUSED], true)) {
            return now();
        }
        if ($subscription->ends_at !== null) {
            return $subscription->ends_at;
        }
        $periodEnd = data_get($data, 'current_billing_period.ends_at') ?? ($data['next_billed_at'] ?? null);

        return is_string($periodEnd)
            ? Date::parse($periodEnd)->addDays((int) config('plus.grace_days'))
            : now()->addDays((int) config('plus.grace_days'));
    }

    private function subscriptionOwner(Subscription $subscription): User|Family|null
    {
        if (preg_match('/^family:(\d+)$/', $subscription->type, $m)) {
            return Family::query()->find((int) $m[1]);
        }

        return self::user($subscription->billable);
    }

    /**
     * @param  array<mixed>  $custom
     */
    private function target(string $kind, array $custom, ?User $payer): User|Family|GtaServer|null
    {
        return match ($kind) {
            'gift' => is_numeric($custom['to_user_id'] ?? null) ? User::query()->find((int) $custom['to_user_id']) : null,
            'promo' => is_numeric($custom['server_id'] ?? null) ? GtaServer::query()->find((int) $custom['server_id']) : null,
            'family' => is_numeric($custom['family_id'] ?? null) ? Family::query()->find((int) $custom['family_id']) : null,
            default => $payer,
        };
    }

    /** Cashier типізує billable як трейт — звужуємо до нашої моделі. */
    private static function user(mixed $billable): ?User
    {
        return $billable instanceof User ? $billable : null;
    }
}
