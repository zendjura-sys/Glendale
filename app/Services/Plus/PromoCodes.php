<?php

namespace App\Services\Plus;

use App\Models\PaymentCard;
use App\Models\PaymentOrder;
use App\Models\PlusCode;
use App\Models\PlusCodeRedemption;
use App\Models\PlusPayment;
use App\Models\User;
use App\Services\Billing\Catalog;
use App\Services\Billing\Shop;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Промокоди GameCon+:
 *  - days          — дні GameCon+ одразу, без оплати;
 *  - discount      — знижка на підписку (відсоток або сума) на `payments` оплат (null — на всі, поки діє);
 *  - first_payment — знижка лише на перший платіж;
 *  - trial         — безкоштовний період (місяці або дні), після нього — автопродовження обраного тарифу.
 * Обмеження: кількість використань, строк дії, «лише для нових» (хто ще не платив), перелік тарифів.
 */
class PromoCodes
{
    public const TYPES = ['days', 'discount', 'first_payment', 'trial'];

    public function __construct(private readonly Plus $plus, private readonly Catalog $catalog) {}

    /**
     * Активувати промокод. Для пробного періоду потрібен тариф (product), інакше береться перший доступний.
     *
     * @return array{type: string, message: string}
     */
    public function redeem(User $user, string $code, ?string $product = null): array
    {
        return DB::transaction(function () use ($user, $code, $product) {
            $row = PlusCode::query()->where('code', mb_strtoupper(trim($code)))->lockForUpdate()->first();
            if ($row === null || ! $row->usable()) {
                throw ValidationException::withMessages(['code' => 'Промокод недійсний або вже використаний.']);
            }
            if ($row->redemptions()->where('user_id', $user->id)->exists()) {
                throw ValidationException::withMessages(['code' => 'Ви вже використали цей промокод.']);
            }
            if ($row->new_only && $this->hasPaid($user)) {
                throw ValidationException::withMessages(['code' => 'Цей промокод — лише для тих, хто ще не купував GameCon+.']);
            }

            $type = in_array($row->type, self::TYPES, true) ? $row->type : 'days';
            $message = match ($type) {
                'days' => $this->days($user, $row),
                'trial' => $this->trial($user, $row, $product),
                default => $this->discount($user, $row),
            };
            $row->increment('uses');

            return ['type' => $type, 'message' => $message];
        });
    }

    /**
     * Найвигідніша знижка людини на цей тариф (активовані промокоди «знижка» й «перший платіж»).
     *
     * @return array{redemption: PlusCodeRedemption|null, amount: int}
     */
    public function discountFor(User $user, string $product, int $price): array
    {
        $kind = $this->catalog->get($product)['kind'] ?? null;
        if (! in_array($kind, ['plus', 'family', 'gift'], true)) {
            return ['redemption' => null, 'amount' => 0];
        }
        $best = ['redemption' => null, 'amount' => 0];
        $rows = PlusCodeRedemption::query()->with('code')->where('user_id', $user->id)
            ->where(fn ($q) => $q->whereNull('payments_left')->orWhere('payments_left', '>', 0))->get();
        foreach ($rows as $redemption) {
            $code = $redemption->code;
            if (! in_array($code->type, ['discount', 'first_payment'], true)) {
                continue;
            }
            if ($code->products !== null && $code->products !== [] && ! in_array($product, $code->products, true)) {
                continue;
            }
            // Подарунок — не підписка: знижка діє, лише якщо промокод прямо дозволяє тариф подарунка.
            if ($kind === 'gift' && ($code->products === null || ! in_array($product, $code->products, true))) {
                continue;
            }
            $amount = $code->percent !== null ? (int) round($price * min(100, $code->percent) / 100) : (int) ($code->amount_off ?? 0) * 100;
            $amount = min($price, max(0, $amount));
            if ($amount > $best['amount']) {
                $best = ['redemption' => $redemption, 'amount' => $amount];
            }
        }

        return $best;
    }

    /** Оплату зі знижкою проведено: мінус одна оплата з ліміту. */
    public function consume(?int $redemptionId): void
    {
        if ($redemptionId === null) {
            return;
        }
        $row = PlusCodeRedemption::query()->find($redemptionId);
        if ($row === null) {
            return;
        }
        $row->update([
            'applied' => $row->applied + 1,
            'payments_left' => $row->payments_left === null ? null : max(0, $row->payments_left - 1),
        ]);
    }

    /**
     * Опис промокоду для адмінки й людей.
     */
    public static function describe(PlusCode $code): string
    {
        $value = $code->percent !== null ? $code->percent.'%' : ($code->amount_off ?? 0).' ₴';

        return match ($code->type) {
            'discount' => 'Знижка '.$value.($code->payments === null ? ' на всі оплати підписки' : ' на '.$code->payments.' '.self::plural($code->payments, 'оплату', 'оплати', 'оплат')),
            'first_payment' => 'Знижка '.$value.' на перший платіж',
            'trial' => ($code->months > 0 ? $code->months.' '.self::plural($code->months, 'місяць', 'місяці', 'місяців') : $code->days.' '.self::plural($code->days, 'день', 'дні', 'днів')).' безкоштовно, далі — підписка',
            default => $code->days.' '.self::plural($code->days, 'день', 'дні', 'днів').' GameCon+',
        };
    }

    private function days(User $user, PlusCode $row): string
    {
        $row->redemptions()->create(['user_id' => $user->id, 'payments_left' => 0]);
        $grant = $this->plus->grant($user, max(1, $row->days), 'code', note: $row->code);

        return 'Промокод активовано: GameCon+ до '.$grant->ends_at->format('d.m.Y').'.';
    }

    private function discount(User $user, PlusCode $row): string
    {
        $row->redemptions()->create([
            'user_id' => $user->id,
            'payments_left' => $row->type === 'first_payment' ? 1 : $row->payments,
        ]);

        return 'Промокод активовано: '.mb_strtolower(self::describe($row)).'. Знижка врахується під час оплати.';
    }

    /** Безкоштовний період: GameCon+ одразу, після нього — автопродовження обраного тарифу (збереженою карткою). */
    private function trial(User $user, PlusCode $row, ?string $product): string
    {
        $allowed = array_values(array_filter(
            $this->catalog->renewable(),
            fn (string $key) => ($this->catalog->get($key)['kind'] ?? null) === 'plus' && $this->catalog->enabled($key)
                && ($row->products === null || $row->products === [] || in_array($key, $row->products, true)),
        ));
        $product = in_array($product, $allowed, true) ? $product : ($allowed[0] ?? null);
        if ($product === null) {
            throw ValidationException::withMessages(['code' => 'Зараз немає тарифу, до якого можна застосувати цей промокод.']);
        }
        $days = $row->months > 0 ? $row->months * 30 : max(1, $row->days);
        $row->redemptions()->create(['user_id' => $user->id, 'payments_left' => 0, 'product' => $product]);
        $grant = $this->plus->grant($user, $days, 'code', note: $row->code);
        $card = PaymentCard::query()->where('user_id', $user->id)->latest('id')->value('id');
        app(Shop::class)->setRenewal($user, $product, $user, true, $card);

        return 'Безкоштовно до '.$grant->ends_at->format('d.m.Y').'. Далі — '.$this->catalog->label($product).($card === null
            ? ': оплатіть або збережіть картку в GameCon+ → Оплата, щоб продовження було автоматичним.'
            : ' з вашої збереженої картки (вимкнути можна будь-коли).');
    }

    private function hasPaid(User $user): bool
    {
        return PaymentOrder::query()->where('user_id', $user->id)->where('status', PaymentOrder::PAID)->exists()
            || PlusPayment::query()->where('user_id', $user->id)->exists();
    }

    private static function plural(int $n, string $one, string $few, string $many): string
    {
        $mod10 = $n % 10;
        $mod100 = $n % 100;

        return $mod10 === 1 && $mod100 !== 11 ? $one : ($mod10 >= 2 && $mod10 <= 4 && ($mod100 < 12 || $mod100 > 14) ? $few : $many);
    }
}
