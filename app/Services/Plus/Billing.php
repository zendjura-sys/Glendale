<?php

namespace App\Services\Plus;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\PlusSubscription;
use App\Models\ServerPromotion;
use App\Models\User;
use App\Notifications\PlusGifted;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;

/**
 * Події Lemon Squeezy → підписки, платежі, подарунки й просування.
 * Кожна подія безпечна для повтору: платежі унікальні за ID замовлення, підписки — за ID підписки.
 */
class Billing
{
    public function __construct(
        private readonly Plus $plus,
        private readonly LemonSqueezy $lemon,
        private readonly ServerPromotions $promotions,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(array $payload): void
    {
        $event = (string) data_get($payload, 'meta.event_name', '');
        $custom = (array) data_get($payload, 'meta.custom_data', []);
        $id = (string) data_get($payload, 'data.id', '');
        $attributes = (array) data_get($payload, 'data.attributes', []);
        if ($id === '') {
            return;
        }

        match (true) {
            str_starts_with($event, 'subscription_') && ! str_starts_with($event, 'subscription_payment') => $this->subscription($id, $attributes, $custom),
            $event === 'order_created' => $this->order($id, $attributes, $custom),
            $event === 'order_refunded' => $this->refund($id),
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<mixed>  $custom
     */
    private function subscription(string $id, array $a, array $custom): void
    {
        $existing = PlusSubscription::query()->where('provider', LemonSqueezy::PROVIDER)->where('provider_id', $id)->first();
        $product = $this->product($a['variant_id'] ?? null, $custom) ?? $existing?->product;
        $meta = $product !== null ? (array) config("plus.products.{$product}") : [];
        if ($existing === null && ! in_array($meta['kind'] ?? null, ['plus', 'family'], true)) {
            return;
        }

        $owner = $existing === null ? $this->subscriptionOwner((string) $meta['kind'], $custom) : null;
        if ($existing === null && $owner === null) {
            return;
        }

        $subscription = PlusSubscription::query()->updateOrCreate(
            ['provider' => LemonSqueezy::PROVIDER, 'provider_id' => $id],
            [
                ...($owner !== null ? ['owner_type' => $this->plus->type($owner), 'owner_id' => $owner->id, 'user_id' => $this->payer($custom)?->id] : []),
                'product' => $product,
                'status' => (string) ($a['status'] ?? 'active'),
                'renews_at' => $this->date($a['renews_at'] ?? null),
                'ends_at' => $this->date($a['ends_at'] ?? null),
                'portal_url' => is_string(data_get($a, 'urls.customer_portal')) ? data_get($a, 'urls.customer_portal') : null,
            ],
        );
        $this->plus->syncSubscription($subscription);
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<mixed>  $custom
     */
    private function order(string $id, array $a, array $custom): void
    {
        if (($a['status'] ?? null) !== 'paid') {
            return;
        }
        $product = $this->product(data_get($a, 'first_order_item.variant_id'), $custom);
        if ($product === null) {
            return;
        }
        $meta = (array) config("plus.products.{$product}");

        DB::transaction(function () use ($id, $a, $custom, $product, $meta) {
            $payer = $this->payer($custom);
            $target = $this->target((string) ($meta['kind'] ?? ''), $custom, $payer);
            $payment = PlusPayment::query()->firstOrCreate(
                ['provider' => LemonSqueezy::PROVIDER, 'provider_id' => $id],
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
                    'amount' => (int) ($a['total'] ?? 0),
                    'currency' => (string) ($a['currency'] ?? 'USD'),
                    'status' => PlusPayment::PAID,
                    'receipt_url' => is_string(data_get($a, 'urls.receipt')) ? data_get($a, 'urls.receipt') : null,
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

    private function refund(string $id): void
    {
        $payment = PlusPayment::query()->where('provider', LemonSqueezy::PROVIDER)->where('provider_id', $id)->first();
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
     * @param  array<mixed>  $custom
     */
    private function product(mixed $variant, array $custom): ?string
    {
        $byVariant = is_scalar($variant) ? $this->lemon->productForVariant((string) $variant) : null;
        $fallback = is_string($custom['product'] ?? null) && array_key_exists($custom['product'], (array) config('plus.products')) ? $custom['product'] : null;

        return $byVariant ?? $fallback;
    }

    /**
     * @param  array<mixed>  $custom
     */
    private function payer(array $custom): ?User
    {
        return is_numeric($custom['user_id'] ?? null) ? User::query()->find((int) $custom['user_id']) : null;
    }

    /**
     * @param  array<mixed>  $custom
     */
    private function subscriptionOwner(string $kind, array $custom): User|Family|null
    {
        return $kind === 'family'
            ? (is_numeric($custom['family_id'] ?? null) ? Family::query()->find((int) $custom['family_id']) : null)
            : $this->payer($custom);
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

    private function date(mixed $value): ?CarbonInterface
    {
        return is_string($value) && $value !== '' ? Date::parse($value) : null;
    }
}
