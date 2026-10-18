<?php

namespace App\Services\Billing;

use App\Models\PaymentCard;
use App\Models\PaymentOrder;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\User;
use App\Notifications\BillingNotice;
use App\Services\Phones\PhoneNumbers;
use App\Services\Plus\PromoCodes;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Оплата карткою через monobank: замовлення → рахунок monobank (сторінка оплати, Google Pay або збережена
 * картка) → вебхук / перевірка статусу → товар вмикається (Shop::fulfil). Баланс рахунку більше не поповнюється;
 * залишок старого балансу зараховується в ціну наступної покупки.
 */
class Checkout
{
    /** Без 0/O й 1/I, щоб код легко переписати. */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(
        private readonly MonobankAcquiring $monobank,
        private readonly Shop $shop,
        private readonly Catalog $catalog,
    ) {}

    /** Оплата карткою доступна: адміністратор додав токен еквайрингу. */
    public function available(): bool
    {
        return $this->monobank->configured();
    }

    /**
     * Почати покупку: замовлення й сторінка оплати monobank. Якщо ціну повністю покриває старий баланс —
     * товар вмикається одразу.
     *
     * @param  array<string, mixed>  $input
     */
    public function start(User $payer, string $product, array $input, bool $renew, bool $saveCard): PaymentOrder
    {
        if (! $this->catalog->enabled($product)) {
            throw ValidationException::withMessages(['product' => 'Цей товар зараз не продається.']);
        }
        $target = $this->shop->target($payer, $product, $input);
        $recurring = (bool) ($this->catalog->get($product)['recurring'] ?? false);
        $price = $this->catalog->priceFor($payer, $product);
        $promo = app(PromoCodes::class)->discountFor($payer, $product, $price);
        $credit = min(max(0, (int) $payer->balance), $price - $promo['amount']);
        $renew = $renew && $recurring;

        $order = PaymentOrder::query()->create([
            'code' => $this->newCode(),
            'user_id' => $payer->id,
            'kind' => 'purchase',
            'product' => $product,
            'target_type' => $this->shop->targetType($target),
            'target_id' => $target->id,
            'renew' => $renew,
            'save_card' => $saveCard && $renew,
            'price' => $price,
            'discount' => $promo['amount'],
            'promo_redemption_id' => $promo['redemption']?->id,
            'credit_used' => $credit,
            'amount' => $price - $promo['amount'] - $credit,
            'status' => PaymentOrder::PENDING,
            'method' => $price - $promo['amount'] === 0 ? 'promo' : ($credit > 0 && $credit === $price - $promo['amount'] ? 'balance' : 'card'),
            'expires_at' => now()->addHours(max(1, $this->catalog->rules()['order_hours'])),
        ]);

        if ($order->amount === 0) {
            $this->paid($order, null);

            return $order->refresh();
        }
        if (! $this->available()) {
            $order->update(['status' => PaymentOrder::CANCELLED, 'failure' => 'Оплата карткою тимчасово недоступна.']);
            throw ValidationException::withMessages(['product' => 'Оплата карткою тимчасово недоступна. Спробуйте пізніше.']);
        }

        try {
            $invoice = $this->monobank->createInvoice(
                $order->amount,
                $this->info($order),
                $this->url('billing.orders.return', ['order' => $order->id]),
                $this->url('billing.monobank.webhook'),
                (int) now()->diffInSeconds($order->expires_at),
                $order->save_card ? $this->walletId($payer) : null,
            );
        } catch (Throwable $e) {
            $order->update(['status' => PaymentOrder::CANCELLED, 'failure' => $this->reason($e)]);
            throw ValidationException::withMessages(['product' => $this->reason($e)]);
        }
        $order->update(['invoice_id' => $invoice['invoiceId'], 'page_url' => $invoice['pageUrl']]);

        return $order;
    }

    /**
     * Оплата через нативну кнопку Google Pay: токен з Google Pay → monobank. Повертає адресу перевірки 3-D Secure,
     * якщо банк її вимагає, і стан замовлення.
     *
     * @return array{tds_url: string|null, order: PaymentOrder}
     */
    public function googlePay(PaymentOrder $order, string $token): array
    {
        abort_unless($order->open() && $order->kind === 'purchase', 422, 'Це замовлення вже закрите.');
        try {
            $result = $this->monobank->walletPayment(
                ['aToken' => $token],
                $order->amount,
                $this->info($order),
                'client',
                $this->url('billing.monobank.webhook'),
                $this->url('billing.orders.return', ['order' => $order->id]),
            );
        } catch (Throwable $e) {
            throw ValidationException::withMessages(['token' => $this->reason($e)]);
        }
        // Нативна оплата — окремий рахунок monobank; попередня сторінка оплати більше не потрібна.
        $old = $order->invoice_id;
        $order->update(['invoice_id' => (string) ($result['invoiceId'] ?? $old), 'method' => 'google_pay']);
        if ($old !== null && $old !== $order->invoice_id) {
            rescue(fn () => $this->monobank->remove($old), report: false);
        }
        $this->handle($result + ['invoiceId' => $order->invoice_id], false);

        return ['tds_url' => is_string($result['tdsUrl'] ?? null) ? $result['tdsUrl'] : null, 'order' => $order->refresh()];
    }

    /**
     * Автопродовження збереженою карткою (ініціює магазин, людина не бере участі).
     */
    public function chargeSaved(PlusRenewal $renewal, PaymentCard $card): PaymentOrder
    {
        $payer = $renewal->user;
        $price = $this->catalog->price($renewal->product);
        $promo = app(PromoCodes::class)->discountFor($payer, $renewal->product, $price);
        $credit = min(max(0, (int) $payer->balance), $price - $promo['amount']);
        $order = PaymentOrder::query()->create([
            'code' => $this->newCode(),
            'user_id' => $payer->id,
            'kind' => 'renewal',
            'product' => $renewal->product,
            'target_type' => $renewal->owner_type,
            'target_id' => $renewal->owner_id,
            'renew' => true,
            'price' => $price,
            'discount' => $promo['amount'],
            'promo_redemption_id' => $promo['redemption']?->id,
            'credit_used' => $credit,
            'amount' => $price - $promo['amount'] - $credit,
            'status' => PaymentOrder::PENDING,
            'method' => 'saved_card',
            'renewal_id' => $renewal->id,
            'card_id' => $card->id,
            'masked_pan' => $card->masked_pan,
            'expires_at' => now()->addHours(2),
        ]);
        if ($order->amount === 0) {
            $this->paid($order, null);

            return $order->refresh();
        }

        try {
            $result = $this->monobank->walletPayment(
                ['cardToken' => $card->token],
                $order->amount,
                $this->info($order),
                'merchant',
                $this->url('billing.monobank.webhook'),
            );
        } catch (Throwable $e) {
            $this->failed($order, $this->reason($e));

            return $order->refresh();
        }
        $card->update(['last_used_at' => now()]);
        $order->update(['invoice_id' => is_string($result['invoiceId'] ?? null) ? $result['invoiceId'] : null]);
        if ($order->invoice_id !== null) {
            $this->handle($result + ['invoiceId' => $order->invoice_id], false);
        }

        return $order->refresh();
    }

    /**
     * Стан рахунку monobank (вебхук або перевірка) → замовлення. Повторні й застарілі вебхуки ігноруються.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, bool $webhook): ?PaymentOrder
    {
        $invoiceId = is_string($data['invoiceId'] ?? null) ? $data['invoiceId'] : null;
        $status = is_string($data['status'] ?? null) ? $data['status'] : null;
        if ($invoiceId === null || $status === null) {
            return null;
        }
        $order = PaymentOrder::query()->where('invoice_id', $invoiceId)->first();
        if ($order === null) {
            return null;
        }
        if ($webhook && ! $this->firstTime($invoiceId, $status, (string) ($data['modifiedDate'] ?? ''))) {
            return $order;
        }

        $pan = data_get($data, 'paymentInfo.maskedPan');
        if (is_string($pan) && $pan !== '' && $order->masked_pan === null) {
            $order->update(['masked_pan' => $pan]);
        }

        match ($status) {
            MonobankAcquiring::SUCCESS => $this->paid($order, $data),
            MonobankAcquiring::FAILURE, MonobankAcquiring::EXPIRED => $this->failed($order, $this->failureText($data, $status)),
            MonobankAcquiring::REVERSED => $this->reversed($order, $data),
            default => null,
        };

        return $order->refresh();
    }

    /** Людина повернулася зі сторінки оплати раніше за вебхук — питаємо банк самі. */
    public function sync(PaymentOrder $order): PaymentOrder
    {
        if ($order->status === PaymentOrder::PENDING && $order->invoice_id !== null && $this->available()) {
            try {
                $this->handle($this->monobank->status($order->invoice_id), false);
            } catch (Throwable $e) {
                Log::info('monobank status', ['order' => $order->id, 'error' => $e->getMessage()]);
            }
        }

        return $order->refresh();
    }

    /** Скасувати неоплачене замовлення (рахунок monobank теж). */
    public function cancel(PaymentOrder $order): void
    {
        abort_unless($order->status === PaymentOrder::PENDING, 422, 'Це замовлення вже закрите.');
        if ($order->invoice_id !== null && $this->available()) {
            rescue(fn () => $this->monobank->remove($order->invoice_id), report: false);
        }
        $order->update(['status' => PaymentOrder::CANCELLED]);
        $this->releasePhone($order);
    }

    /** Неоплачений номер більше не тримаємо — його може взяти інший. */
    private function releasePhone(PaymentOrder $order): void
    {
        if ($order->target_type === 'phone') {
            app(PhoneNumbers::class)->releaseHold($order->target_id);
        }
    }

    /**
     * Повернення на картку (адміністратор): товар знімається, гроші — назад на картку, залишок старого балансу — на баланс.
     */
    public function refund(PaymentOrder $order, User $by): void
    {
        abort_unless($order->status === PaymentOrder::PAID, 422, 'Повернути можна лише оплачене замовлення.');
        $left = $order->amount - $order->refunded;
        if ($left > 0 && $order->invoice_id !== null) {
            try {
                $this->monobank->cancel($order->invoice_id, $left, $order->code);
            } catch (Throwable $e) {
                throw ValidationException::withMessages(['order' => $this->reason($e)]);
            }
        }
        DB::transaction(function () use ($order, $by, $left) {
            $order->update(['status' => PaymentOrder::REFUNDED, 'refunded' => $order->refunded + max(0, $left)]);
            if ($order->payment !== null) {
                $this->shop->refund($order->payment, $by);
            }
        });
    }

    /**
     * Збережені картки людини.
     *
     * @return list<array{id: int, masked_pan: string, payment_system: string|null}>
     */
    public function cards(User $user): array
    {
        return array_values(PaymentCard::query()->where('user_id', $user->id)->latest('id')->get()->map->toCard()->all());
    }

    /** Видалити картку: і в банку (токен перестає діяти), і в нас; автопродовження з нею переходять у ручний режим. */
    public function forget(PaymentCard $card): void
    {
        if ($this->available()) {
            rescue(fn () => $this->monobank->deleteCard($card->token), report: false);
        }
        PlusRenewal::query()->where('card_id', $card->id)->update(['card_id' => null]);
        $card->delete();
    }

    /**
     * @param  array<string, mixed>|null  $data
     */
    private function paid(PaymentOrder $order, ?array $data): void
    {
        $done = DB::transaction(function () use ($order) {
            $row = PaymentOrder::query()->lockForUpdate()->find($order->id);
            if ($row === null || $row->status !== PaymentOrder::PENDING) {
                return false;
            }
            $row->update(['status' => PaymentOrder::PAID, 'paid_at' => now(), 'failure' => null]);
            $this->shop->fulfil($row);
            app(PromoCodes::class)->consume($row->promo_redemption_id);

            return true;
        });
        if (! $done) {
            return;
        }
        $order->refresh();
        $card = $this->rememberCard($order, $data);
        if ($card !== null && $order->renew) {
            PlusRenewal::query()->where('user_id', $order->user_id)->where('owner_type', $order->target_type)
                ->where('owner_id', $order->target_id)->update(['card_id' => $card->id]);
        }
        $order->user->notify(new BillingNotice(
            $order->kind === 'renewal' ? 'plus_renewed' : 'payment_paid',
            ($order->kind === 'renewal' ? 'Продовжено: ' : 'Оплачено: ').$this->catalog->label($order->product).' · '.Wallet::uah($order->price).'.',
        ));
    }

    private function failed(PaymentOrder $order, string $reason): void
    {
        $changed = PaymentOrder::query()->whereKey($order->id)->where('status', PaymentOrder::PENDING)
            ->update(['status' => PaymentOrder::FAILED, 'failure' => mb_substr($reason, 0, 255)]);
        if ($changed > 0) {
            $this->releasePhone($order);
        }
        if ($changed === 0 || $order->kind !== 'renewal' || $order->renewal_id === null) {
            return;
        }
        $renewal = PlusRenewal::query()->find($order->renewal_id);
        if ($renewal === null) {
            return;
        }
        $renewal->update(['failed_at' => now(), 'attempts' => $renewal->attempts + 1]);
        $last = $renewal->attempts >= max(1, $this->catalog->rules()['retry_max']);
        $order->user->notify(new BillingNotice(
            'plus_renewal_failed',
            'Не вдалося продовжити '.$this->catalog->label($order->product).' карткою '.($order->masked_pan ?? '').': '.$reason.'. '
                .($last ? 'Автоматичних спроб більше не буде — оплатіть вручну в GameCon+.' : 'Спробуємо ще раз пізніше.'),
        ));
    }

    /**
     * Банк повернув кошти (з кабінету monobank або через адмінку): знімаємо товар, якщо ще не знятий.
     *
     * @param  array<string, mixed>  $data
     */
    private function reversed(PaymentOrder $order, array $data): void
    {
        if ($order->status !== PaymentOrder::PAID) {
            return;
        }
        $refunded = collect((array) ($data['cancelList'] ?? []))->filter(fn ($op) => ($op['status'] ?? null) === 'success')->sum(fn ($op) => (int) ($op['amount'] ?? 0));
        $order->update(['status' => PaymentOrder::REFUNDED, 'refunded' => max($order->refunded, (int) $refunded ?: $order->amount)]);
        if ($order->payment !== null && $order->payment->status !== PlusPayment::REFUNDED) {
            $this->shop->refund($order->payment, null);
        }
    }

    /**
     * @param  array<string, mixed>|null  $data
     */
    private function rememberCard(PaymentOrder $order, ?array $data): ?PaymentCard
    {
        $token = data_get($data, 'walletData.cardToken');
        if (! $order->save_card || ! is_string($token) || $token === '') {
            return $order->card_id !== null ? PaymentCard::query()->find($order->card_id) : null;
        }

        return PaymentCard::query()->updateOrCreate(
            ['token_hash' => hash('sha256', $token)],
            [
                'user_id' => $order->user_id,
                'provider' => 'monobank',
                'token' => $token,
                'masked_pan' => (string) (data_get($data, 'paymentInfo.maskedPan') ?? $order->masked_pan ?? '****'),
                'payment_system' => data_get($data, 'paymentInfo.paymentSystem'),
                'country' => data_get($data, 'paymentInfo.country'),
                'last_used_at' => now(),
            ],
        );
    }

    /** Перша поява цієї події (invoiceId + статус + час зміни)? Повтори банку й підроблені повтори — ні. */
    private function firstTime(string $invoiceId, string $status, string $modified): bool
    {
        try {
            DB::table('payment_webhooks')->insert([
                'provider' => 'monobank',
                'event_key' => hash('sha256', $invoiceId.'|'.$status.'|'.$modified),
                'invoice_id' => $invoiceId,
                'status' => $status,
                'created_at' => now(),
            ]);

            return true;
        } catch (QueryException) {
            return false;
        }
    }

    /**
     * Призначення платежу й кошик (кошик потрібен для фіскалізації через ПРРО monobank).
     *
     * @return array{reference: string, destination: string, basket: list<array<string, mixed>>}
     */
    private function info(PaymentOrder $order): array
    {
        $name = $this->catalog->label($order->product);

        return [
            'reference' => $order->code,
            'destination' => 'Оплата послуги «'.$name.'» на '.parse_url((string) config('app.url'), PHP_URL_HOST).', замовлення '.$order->code,
            'basket' => [[
                'name' => $name,
                'qty' => 1,
                'sum' => $order->amount,
                'total' => $order->amount,
                'code' => $order->product,
                'unit' => 'послуга',
            ]],
        ];
    }

    /**
     * Адреса сайту для банку: від APP_URL, а не від поточного запиту (автопродовження йде без запиту, за проксі хост інший).
     *
     * @param  array<string, mixed>  $parameters
     */
    private function url(string $route, array $parameters = []): string
    {
        return rtrim((string) config('app.url'), '/').route($route, $parameters, false);
    }

    private function walletId(User $user): string
    {
        return 'gc-user-'.$user->id;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function failureText(array $data, string $status): string
    {
        if ($status === MonobankAcquiring::EXPIRED) {
            return 'Час на оплату минув.';
        }
        $reason = $data['failureReason'] ?? null;

        return is_string($reason) && $reason !== '' ? $reason : 'Банк відхилив оплату.';
    }

    private function reason(Throwable $e): string
    {
        return $e instanceof MonobankException ? $e->getMessage() : 'Не вдалося зв’язатися з monobank. Спробуйте пізніше.';
    }

    private function newCode(): string
    {
        do {
            $code = 'GC-'.collect(range(1, 6))->map(fn () => self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)])->implode('');
        } while (PaymentOrder::query()->where('code', $code)->exists());

        return $code;
    }
}
