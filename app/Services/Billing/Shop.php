<?php

namespace App\Services\Billing;

use App\Http\Controllers\PlusController;
use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PaymentOrder;
use App\Models\PhoneNumber;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\ServerPromotion;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Notifications\BillingNotice;
use App\Notifications\PlusGifted;
use App\Services\Phones\PhoneNumbers;
use App\Services\Plus\Plus;
use App\Services\Plus\ServerPromotions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Покупки з рахунку: GameCon+, GameCon+ для сім’ї, подарунки, просування серверів; автопродовження й повернення.
 */
class Shop
{
    public function __construct(
        private readonly Wallet $wallet,
        private readonly Plus $plus,
        private readonly ServerPromotions $promotions,
    ) {}

    /** Ціна товару в копійках (з урахуванням правок адмінки). */
    public static function price(string $product): int
    {
        return app(Catalog::class)->price($product);
    }

    /** Товар у продажу: є в каталозі й не знятий адміністратором. */
    public static function enabled(string $product): bool
    {
        return app(Catalog::class)->enabled($product);
    }

    /**
     * Товари в продажу з цінами (₴) — для сторінок цін, GameCon+ і просування.
     *
     * @return array<string, array{kind: string, promo: string|null, name: string, price: int, old_price: int|null, days: int, recurring: bool, badge: string|null, available: bool}>
     */
    public static function catalog(): array
    {
        $out = [];
        foreach (app(Catalog::class)->products() as $key => $product) {
            $out[$key] = [
                'kind' => $product['kind'],
                'promo' => $product['promo'],
                'name' => $product['name'],
                'price' => $product['price'],
                'old_price' => $product['old_price'],
                'days' => $product['days'],
                'recurring' => $product['recurring'],
                'badge' => $product['badge'],
                'available' => $product['enabled'],
            ];
        }

        return $out;
    }

    public static function label(string $product): string
    {
        return app(Catalog::class)->label($product);
    }

    /**
     * Для кого купують: GameCon+ — собі, подарунок — людині за ніком, сім’я — та, де платник лідер,
     * просування — сервер, яким платник володіє.
     *
     * @param  array<string, mixed>  $input
     */
    public function target(User $payer, string $product, array $input): User|Family|GtaServer|PhoneNumber
    {
        $kind = (string) (app(Catalog::class)->get($product)['kind'] ?? '');

        return match ($kind) {
            'plus' => $payer,
            'gift' => $this->recipient($payer, (string) ($input['username'] ?? '')),
            'family' => PlusController::ledFamilies($payer)->firstWhere('id', (int) ($input['family_id'] ?? 0))
                ?? throw ValidationException::withMessages(['family_id' => 'Підключити GameCon+ для сім’ї може лише її лідер.']),
            'promo' => $this->ownServer($payer, (int) ($input['server_id'] ?? 0)),
            // Номер тримається за покупцем, поки триває оплата (без дублікатів — PhoneNumbers::hold).
            'phone' => app(PhoneNumbers::class)->hold(
                $payer,
                (string) ($input['phone_operator'] ?? ''),
                (string) ($input['phone_digits'] ?? ''),
                $product,
                // Подарунок другові (оплачує дарувальник, друг приймає).
                filled($input['gift_to'] ?? null) ? (User::query()->find((int) $input['gift_to']) ?? throw ValidationException::withMessages(['friend' => 'Друга не знайдено.'])) : null,
            ),
            default => throw ValidationException::withMessages(['product' => 'Невідомий товар.']),
        };
    }

    /**
     * Купити з рахунку. renew — увімкнути автопродовження (для GameCon+ і GameCon+ сім’ї).
     *
     * @param  array<string, mixed>  $input
     *
     * @throws InsufficientFunds
     */
    public function buy(User $payer, string $product, array $input, bool $renew = false): PlusPayment
    {
        if (! self::enabled($product)) {
            throw ValidationException::withMessages(['product' => 'Цей товар зараз не продається.']);
        }
        $target = $this->target($payer, $product, $input);

        return DB::transaction(function () use ($payer, $product, $target, $renew) {
            $payment = $this->charge($payer, $product, $target, 'purchase', 'Покупка: '.self::label($product));
            $this->apply($payment, $product, $target, $payer, 'purchase');

            if ($target instanceof User || $target instanceof Family) {
                if ((string) (app(Catalog::class)->get($product)['kind'] ?? '') !== 'gift') {
                    $this->setRenewal($payer, $product, $target, $renew);
                }
            }

            return $payment;
        });
    }

    /** Увімкнути / вимкнути автопродовження для власника (людини чи сім’ї). */
    public function setRenewal(User $payer, string $product, User|Family $owner, bool $active, ?int $cardId = null): ?PlusRenewal
    {
        $where = ['owner_type' => $this->plus->type($owner), 'owner_id' => $owner->id];
        if (! $active) {
            PlusRenewal::query()->where($where)->where('user_id', $payer->id)->update(['active' => false]);

            return null;
        }

        $values = ['user_id' => $payer->id, 'product' => $product, 'active' => true, 'failed_at' => null, 'attempts' => 0];
        if ($cardId !== null) {
            $values['card_id'] = $cardId;
        }

        return PlusRenewal::query()->updateOrCreate($where, $values);
    }

    /**
     * Продовжити, якщо період закінчується найближчим часом (Catalog::rules renew_before_hours) або вже закінчився.
     * Спершу — залишок старого балансу (якщо покриває ціну), далі — збережена картка (оплата приходить вебхуком).
     * Невдалі спроби повторюються через retry_hours, не більше retry_max разів.
     */
    public function renew(PlusRenewal $renewal): bool
    {
        if (! $renewal->active) {
            return false;
        }
        $catalog = app(Catalog::class);
        $rules = $catalog->rules();
        $owner = $this->plus->owner($renewal->owner_type, $renewal->owner_id);
        $payer = $renewal->user;
        $stillLeader = ! $owner instanceof Family || PlusController::ledFamilies($payer)->contains('id', $owner->id);
        if ($owner === null || ! $stillLeader || ! self::enabled($renewal->product) || ! in_array($renewal->product, $catalog->renewable(), true)) {
            $renewal->update(['active' => false]);

            return false;
        }
        if ($owner->plus_until !== null && $owner->plus_until->gt(now()->addHours($rules['renew_before_hours']))) {
            return false;
        }
        if ($renewal->failed_at !== null && $renewal->failed_at->gt(now()->subHours(max(1, $rules['retry_hours'])))) {
            return false;
        }
        if ($renewal->attempts >= max(1, $rules['retry_max'])) {
            return false;
        }

        // Залишок старого балансу покриває ціну — списуємо з нього.
        if ((int) $payer->balance >= self::price($renewal->product)) {
            DB::transaction(function () use ($renewal, $owner, $payer) {
                $payment = $this->charge($payer, $renewal->product, $owner, 'renewal', 'Автопродовження: '.self::label($renewal->product));
                $this->apply($payment, $renewal->product, $owner, $payer, 'renewal');
                $renewal->update(['renewed_at' => now(), 'failed_at' => null, 'attempts' => 0]);
            });
            $owner->refresh();
            $payer->notify(new BillingNotice('plus_renewed', self::label($renewal->product).' продовжено до '.$owner->plus_until?->format('d.m.Y').'.'));

            return true;
        }

        $checkout = app(Checkout::class);
        $card = $renewal->card;
        if ($card === null || ! $rules['card_renewals'] || ! $checkout->available()) {
            $renewal->update(['failed_at' => now(), 'attempts' => $renewal->attempts + 1]);
            $payer->notify(new BillingNotice(
                'plus_renewal_failed',
                self::label($renewal->product).' закінчується — оплатіть продовження в GameCon+'.($card === null ? ' (збережіть картку, щоб наступного разу продовження було автоматичним).' : '.'),
            ));

            return false;
        }
        // Не списувати двічі, поки попередня спроба ще в банку.
        $busy = PaymentOrder::query()->where('renewal_id', $renewal->id)->where('status', PaymentOrder::PENDING)
            ->where('created_at', '>=', now()->subHours(2))->exists();
        if ($busy) {
            return false;
        }

        return $checkout->chargeSaved($renewal, $card)->status === PaymentOrder::PAID;
    }

    /**
     * Видати товар за оплачене замовлення (викликає Checkout після успіху в monobank): запис оплати,
     * GameCon+ / просування, автопродовження з карткою. Залишок старого балансу, зарахований у ціну, списується.
     */
    public function fulfil(PaymentOrder $order): PlusPayment
    {
        if ($order->payment_id !== null && ($existing = PlusPayment::query()->find($order->payment_id)) !== null) {
            return $existing;
        }
        $payer = $order->user;
        $target = $this->targetOf($order->target_type, $order->target_id);
        abort_if($target === null, 422, 'Отримувача покупки більше немає.');

        if ($order->credit_used > 0) {
            try {
                $this->wallet->debit($payer, $order->credit_used, $order->kind === 'renewal' ? 'renewal' : 'purchase', 'Залишок балансу в оплату: '.self::label($order->product), $order->product, 'order:'.$order->id);
            } catch (InsufficientFunds) {
                // Баланс змінився між замовленням і оплатою — товар однаково видаємо, різницю бачить адміністратор.
            }
        }
        $payment = PlusPayment::query()->create([
            'provider' => $order->invoice_id !== null ? 'monobank' : 'wallet',
            'provider_id' => $order->invoice_id ?? 'order-'.$order->id,
            'user_id' => $payer->id,
            'product' => $order->product,
            'target_type' => $order->target_type,
            'target_id' => $order->target_id,
            'amount' => $order->price,
            'currency' => 'UAH',
            'status' => PlusPayment::PAID,
            'receipt_url' => null,
        ]);
        $order->update(['payment_id' => $payment->id]);
        $this->apply($payment, $order->product, $target, $payer, $order->kind === 'renewal' ? 'renewal' : 'purchase');

        if ($order->kind === 'renewal' && $order->renewal_id !== null) {
            PlusRenewal::query()->whereKey($order->renewal_id)->update(['renewed_at' => now(), 'failed_at' => null, 'attempts' => 0]);
        } elseif (($target instanceof User || $target instanceof Family) && (string) (app(Catalog::class)->get($order->product)['kind'] ?? '') !== 'gift') {
            $this->setRenewal($payer, $order->product, $target, $order->renew, $order->card_id);
        }

        return $payment;
    }

    public function targetType(User|Family|GtaServer|PhoneNumber $target): string
    {
        return match (true) {
            $target instanceof PhoneNumber => 'phone',
            $target instanceof GtaServer => 'server',
            $target instanceof Family => 'family',
            default => 'user',
        };
    }

    private function targetOf(string $type, int $id): User|Family|GtaServer|PhoneNumber|null
    {
        return match ($type) {
            'phone' => PhoneNumber::query()->find($id),
            'server' => GtaServer::query()->find($id),
            'family' => Family::query()->find($id),
            default => User::query()->find($id),
        };
    }

    /** Після поповнення — одразу продовжити те, що чекало коштів. */
    public function renewDueFor(User $payer): void
    {
        PlusRenewal::query()->with('user')->where('user_id', $payer->id)->where('active', true)->get()
            ->each(fn (PlusRenewal $r) => $this->renew($r));
    }

    /**
     * Повернення покупки: доступ і просування знімаються. Оплата з балансу — гроші назад на баланс;
     * оплата карткою — повернення на картку робить Checkout::refund (тут — лише залишок балансу, зарахований у ціну).
     */
    public function refund(PlusPayment $payment, ?User $by): void
    {
        DB::transaction(function () use ($payment, $by) {
            $payment = PlusPayment::query()->lockForUpdate()->findOrFail($payment->id);
            abort_if($payment->status === PlusPayment::REFUNDED, 422, 'Цю оплату вже повернуто.');

            $payment->update(['status' => PlusPayment::REFUNDED]);
            foreach (PlusGrant::query()->where('payment_id', $payment->id)->get() as $grant) {
                $this->plus->revoke($grant);
            }
            ServerPromotion::query()->where('payment_id', $payment->id)->update(['ends_at' => now()]);
            app(PhoneNumbers::class)->revoke($payment->id);

            $payer = $payment->user;
            if ($payer !== null && $payment->provider === 'wallet' && str_starts_with($payment->provider_id, 'wt-')) {
                $this->wallet->credit($payer, $payment->amount, 'refund', 'Повернення: '.self::label($payment->product), $payment->product, 'payment:'.$payment->id, $by);
            }
            $order = PaymentOrder::query()->where('payment_id', $payment->id)->first();
            // Повертаємо лише те, що справді списали з балансу (fulfil пропускає списання, якщо коштів уже не було).
            $debited = $order === null ? 0 : -(int) WalletTransaction::query()->where('user_id', $order->user_id)
                ->where('reference', 'order:'.$order->id)->where('amount', '<', 0)->sum('amount');
            $credit = $order === null ? 0 : min($order->credit_used, $debited);
            if ($payer !== null && $order !== null && $credit > 0) {
                $this->wallet->credit($payer, $credit, 'refund', 'Повернення залишку балансу: '.self::label($payment->product), $payment->product, 'order:'.$order->id, $by);
            }
        });
    }

    /**
     * @throws InsufficientFunds
     */
    private function charge(User $payer, string $product, User|Family|GtaServer|PhoneNumber $target, string $type, string $description): PlusPayment
    {
        $price = app(Catalog::class)->priceFor($payer, $product);
        $txn = $this->wallet->debit($payer, $price, $type, $description, $product);
        $payment = PlusPayment::query()->create([
            'provider' => 'wallet',
            'provider_id' => 'wt-'.$txn->id,
            'user_id' => $payer->id,
            'product' => $product,
            'target_type' => match (true) {
                $target instanceof PhoneNumber => 'phone',
                $target instanceof GtaServer => 'server',
                $target instanceof Family => 'family',
                default => 'user',
            },
            'target_id' => $target->id,
            'amount' => $price,
            'currency' => 'UAH',
            'status' => PlusPayment::PAID,
            'receipt_url' => null,
        ]);
        $txn->update(['reference' => 'payment:'.$payment->id]);

        return $payment;
    }

    private function apply(PlusPayment $payment, string $product, User|Family|GtaServer|PhoneNumber $target, User $payer, string $source): void
    {
        $meta = (array) app(Catalog::class)->get($product);
        $days = (int) ($meta['days'] ?? 0);

        if ($target instanceof PhoneNumber) {
            app(PhoneNumbers::class)->activate($target, $payment->id);

            return;
        }

        if ($target instanceof GtaServer) {
            $this->promotions->start($target, (string) ($meta['promo'] ?? 'top'), $days, $payer, $payment->id);

            return;
        }
        if (($meta['kind'] ?? null) === 'gift' && $target instanceof User) {
            $this->plus->grant($target, $days, 'gift', $payer, $payer->name, $payment->id);
            $target->notify(new PlusGifted($payer, $days));

            return;
        }
        $this->plus->grant($target, $days, $source, $payer, null, $payment->id);
    }

    private function recipient(User $payer, string $username): User
    {
        $to = User::query()->where('username', ltrim(trim($username), '@'))->first();
        if ($to === null) {
            throw ValidationException::withMessages(['username' => 'Людину з таким ніком не знайдено.']);
        }
        if ($to->id === $payer->id) {
            throw ValidationException::withMessages(['username' => 'Собі — оберіть звичайний GameCon+.']);
        }

        return $to;
    }

    private function ownServer(User $payer, int $id): GtaServer
    {
        $server = GtaServer::query()->published()->find($id);
        if ($server === null || $server->owner_id !== $payer->id) {
            throw ValidationException::withMessages(['server_id' => 'Просувати сервер може лише його власник.']);
        }

        return $server;
    }
}
