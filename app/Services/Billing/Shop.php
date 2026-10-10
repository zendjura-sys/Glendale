<?php

namespace App\Services\Billing;

use App\Http\Controllers\PlusController;
use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\ServerPromotion;
use App\Models\User;
use App\Notifications\BillingNotice;
use App\Notifications\PlusGifted;
use App\Services\Plus\Plus;
use App\Services\Plus\ServerPromotions;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Покупки з рахунку: GameCon+, GameCon+ для сім’ї, подарунки, просування серверів; автопродовження й повернення.
 */
class Shop
{
    /** За скільки до кінця періоду автопродовження списує оплату. */
    public const RENEW_BEFORE_HOURS = 24;

    public function __construct(
        private readonly Wallet $wallet,
        private readonly Plus $plus,
        private readonly ServerPromotions $promotions,
    ) {}

    /** Ціна товару в копійках. */
    public static function price(string $product): int
    {
        return (int) config("plus.products.{$product}.price") * 100;
    }

    /** Товар у продажу: є в каталозі й не знятий адміністратором. */
    public static function enabled(string $product): bool
    {
        return array_key_exists($product, (array) config('plus.products'))
            && ! in_array($product, (array) app(SiteSettings::class)->get('plus_disabled', []), true);
    }

    /**
     * Товари в продажу з цінами (₴) — для сторінок цін, GameCon+ і просування.
     *
     * @return array<string, array{kind: string, price: int, days: int, recurring: bool, available: bool}>
     */
    public static function catalog(): array
    {
        $out = [];
        foreach ((array) config('plus.products') as $key => $product) {
            $product = (array) $product;
            $out[(string) $key] = [
                'kind' => (string) $product['kind'],
                'price' => (int) $product['price'],
                'days' => (int) $product['days'],
                'recurring' => (bool) $product['recurring'],
                'available' => self::enabled((string) $key),
            ];
        }

        return $out;
    }

    public static function label(string $product): string
    {
        return (string) config("plus.products.{$product}.name", $product);
    }

    /**
     * Для кого купують: GameCon+ — собі, подарунок — людині за ніком, сім’я — та, де платник лідер,
     * просування — сервер, яким платник володіє.
     *
     * @param  array<string, mixed>  $input
     */
    public function target(User $payer, string $product, array $input): User|Family|GtaServer
    {
        $kind = (string) config("plus.products.{$product}.kind");

        return match ($kind) {
            'plus' => $payer,
            'gift' => $this->recipient($payer, (string) ($input['username'] ?? '')),
            'family' => PlusController::ledFamilies($payer)->firstWhere('id', (int) ($input['family_id'] ?? 0))
                ?? throw ValidationException::withMessages(['family_id' => 'Підключити GameCon+ для сім’ї може лише її лідер.']),
            'promo' => $this->ownServer($payer, (int) ($input['server_id'] ?? 0)),
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
                if ((string) config("plus.products.{$product}.kind") !== 'gift') {
                    $this->setRenewal($payer, $product, $target, $renew);
                }
            }

            return $payment;
        });
    }

    /** Увімкнути / вимкнути автопродовження для власника (людини чи сім’ї). */
    public function setRenewal(User $payer, string $product, User|Family $owner, bool $active): ?PlusRenewal
    {
        $where = ['owner_type' => $this->plus->type($owner), 'owner_id' => $owner->id];
        if (! $active) {
            PlusRenewal::query()->where($where)->where('user_id', $payer->id)->update(['active' => false]);

            return null;
        }

        return PlusRenewal::query()->updateOrCreate($where, [
            'user_id' => $payer->id,
            'product' => $product,
            'active' => true,
            'failed_at' => null,
        ]);
    }

    /**
     * Продовжити, якщо період закінчується протягом доби (або вже закінчився).
     * Коштів не вистачає — повідомлення раз на добу, спроба повториться.
     */
    public function renew(PlusRenewal $renewal): bool
    {
        if (! $renewal->active) {
            return false;
        }
        $owner = $this->plus->owner($renewal->owner_type, $renewal->owner_id);
        $payer = $renewal->user;
        $stillLeader = ! $owner instanceof Family || PlusController::ledFamilies($payer)->contains('id', $owner->id);
        if ($owner === null || ! $stillLeader || ! self::enabled($renewal->product)) {
            $renewal->update(['active' => false]);

            return false;
        }
        if ($owner->plus_until !== null && $owner->plus_until->gt(now()->addHours(self::RENEW_BEFORE_HOURS))) {
            return false;
        }

        try {
            DB::transaction(function () use ($renewal, $owner, $payer) {
                $payment = $this->charge($payer, $renewal->product, $owner, 'renewal', 'Автопродовження: '.self::label($renewal->product));
                $this->apply($payment, $renewal->product, $owner, $payer, 'renewal');
                $renewal->update(['renewed_at' => now(), 'failed_at' => null]);
            });
        } catch (InsufficientFunds $e) {
            if ($renewal->failed_at === null || $renewal->failed_at->lt(now()->subDay())) {
                $renewal->update(['failed_at' => now()]);
                $payer->notify(new BillingNotice(
                    'plus_renewal_failed',
                    'Не вдалося продовжити '.self::label($renewal->product).': бракує '.Wallet::uah($e->shortfall).'. Поповніть рахунок — продовження спрацює саме.',
                ));
            }

            return false;
        }

        $owner->refresh();
        $payer->notify(new BillingNotice(
            'plus_renewed',
            self::label($renewal->product).' продовжено з рахунку до '.$owner->plus_until?->format('d.m.Y').'.',
        ));

        return true;
    }

    /** Після поповнення — одразу продовжити те, що чекало коштів. */
    public function renewDueFor(User $payer): void
    {
        PlusRenewal::query()->with('user')->where('user_id', $payer->id)->where('active', true)->get()
            ->each(fn (PlusRenewal $r) => $this->renew($r));
    }

    /**
     * Повернення покупки на рахунок: доступ і просування знімаються, гроші — на баланс платника.
     */
    public function refund(PlusPayment $payment, User $by): void
    {
        DB::transaction(function () use ($payment, $by) {
            $payment = PlusPayment::query()->lockForUpdate()->findOrFail($payment->id);
            abort_if($payment->status === PlusPayment::REFUNDED, 422, 'Цю оплату вже повернуто.');

            $payment->update(['status' => PlusPayment::REFUNDED]);
            foreach (PlusGrant::query()->where('payment_id', $payment->id)->get() as $grant) {
                $this->plus->revoke($grant);
            }
            ServerPromotion::query()->where('payment_id', $payment->id)->update(['ends_at' => now()]);

            $payer = $payment->user;
            if ($payer !== null && $payment->provider === 'wallet') {
                $this->wallet->credit($payer, $payment->amount, 'refund', 'Повернення: '.self::label($payment->product), $payment->product, 'payment:'.$payment->id, $by);
            }
        });
    }

    /**
     * @throws InsufficientFunds
     */
    private function charge(User $payer, string $product, User|Family|GtaServer $target, string $type, string $description): PlusPayment
    {
        $price = self::price($product);
        $txn = $this->wallet->debit($payer, $price, $type, $description, $product);
        $payment = PlusPayment::query()->create([
            'provider' => 'wallet',
            'provider_id' => 'wt-'.$txn->id,
            'user_id' => $payer->id,
            'product' => $product,
            'target_type' => match (true) {
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

    private function apply(PlusPayment $payment, string $product, User|Family|GtaServer $target, User $payer, string $source): void
    {
        $meta = (array) config("plus.products.{$product}");
        $days = (int) ($meta['days'] ?? 0);

        if ($target instanceof GtaServer) {
            $this->promotions->start($target, (string) $meta['promo'], $days, $payer, $payment->id);

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
