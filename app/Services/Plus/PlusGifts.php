<?php

namespace App\Services\Plus;

use App\Models\PlusGift;
use App\Models\PlusPayment;
use App\Models\User;
use App\Notifications\PlusGifted;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Подарунки GameCon+: листівка (побажання, оформлення) і дата вручення.
 * Чернетка створюється до оплати; після оплати подарунок вручається одразу або в обраний день
 * (команда plus:deliver-gifts щогодини). Друг бачить листівку на /plus/gifts/{id}.
 */
class PlusGifts
{
    public function __construct(private readonly Plus $plus) {}

    /**
     * Чернетка листівки перед оплатою (якщо є побажання, оформлення чи дата).
     *
     * @param  array<string, mixed>  $input
     */
    public function draft(User $payer, User $recipient, string $product, int $days, array $input): PlusGift
    {
        $at = filled($input['gift_at'] ?? null) ? Carbon::parse((string) $input['gift_at'], 'Europe/Kyiv')->setTime(10, 0)->utc() : null;
        if ($at !== null && ($at->isPast() || $at->gt(now()->addYear()))) {
            throw ValidationException::withMessages(['gift_at' => 'Дата вручення — від завтра і не далі ніж за рік.']);
        }

        return PlusGift::query()->create([
            'payer_id' => $payer->id,
            'recipient_id' => $recipient->id,
            'product' => $product,
            'days' => $days,
            'message' => filled($input['gift_message'] ?? null) ? mb_substr(trim((string) $input['gift_message']), 0, 200) : null,
            'theme' => in_array($input['gift_theme'] ?? null, PlusGift::THEMES, true) ? $input['gift_theme'] : 'ice',
            'deliver_at' => $at,
            'status' => 'draft',
        ]);
    }

    /** Після оплати: прив’язати чернетку й вручити (або відкласти до дати). */
    public function paid(PlusPayment $payment, User $payer, User $recipient, string $product, int $days): void
    {
        $gift = PlusGift::query()->where('payer_id', $payer->id)->where('recipient_id', $recipient->id)
            ->where('product', $product)->where('status', 'draft')->whereNull('payment_id')
            ->where('created_at', '>', now()->subDays(2))->latest('id')->first()
            ?? new PlusGift(['payer_id' => $payer->id, 'recipient_id' => $recipient->id, 'product' => $product, 'days' => $days, 'theme' => 'ice']);
        $gift->fill(['payment_id' => $payment->id, 'days' => $days]);

        if ($gift->deliver_at !== null && $gift->deliver_at->isFuture()) {
            $gift->fill(['status' => 'scheduled'])->save();

            return;
        }
        $gift->save();
        $this->deliver($gift);
    }

    public function deliver(PlusGift $gift): void
    {
        DB::transaction(function () use ($gift) {
            $fresh = PlusGift::query()->lockForUpdate()->find($gift->id);
            if ($fresh === null || $fresh->status === 'delivered') {
                return;
            }
            $payer = User::query()->find($fresh->payer_id);
            $recipient = User::query()->find($fresh->recipient_id);
            if ($recipient === null) {
                return;
            }
            $this->plus->grant($recipient, $fresh->days, 'gift', $payer, $payer?->name, $fresh->payment_id);
            $fresh->update(['status' => 'delivered', 'delivered_at' => now()]);
            if ($payer !== null) {
                DB::afterCommit(fn () => $recipient->notify(new PlusGifted($payer, $fresh->days, $fresh->id)));
            }
        });
    }

    /** Вручити відкладені подарунки, чий день настав. */
    public function deliverDue(): int
    {
        $due = PlusGift::query()->where('status', 'scheduled')->where('deliver_at', '<=', now())->limit(200)->get();
        $due->each(fn (PlusGift $g) => $this->deliver($g));

        return $due->count();
    }
}
