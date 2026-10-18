<?php

namespace App\Services\Billing;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;

/**
 * Особистий рахунок: баланс у users.balance (копійки) і журнал wallet_transactions.
 *
 * Кожна зміна йде в одній транзакції БД з блокуванням рядка користувача — баланс не піде в мінус
 * навіть за одночасних покупок.
 */
class Wallet
{
    public function credit(User $user, int $amount, string $type, string $description, ?string $product = null, ?string $reference = null, ?User $by = null): WalletTransaction
    {
        return $this->move($user, abs($amount), $type, $description, $product, $reference, $by);
    }

    /**
     * @throws InsufficientFunds
     */
    public function debit(User $user, int $amount, string $type, string $description, ?string $product = null, ?string $reference = null, ?User $by = null): WalletTransaction
    {
        return $this->move($user, -abs($amount), $type, $description, $product, $reference, $by);
    }

    /** Корекція адміністратором: дозволяє і зарахування, і списання (але не в мінус). */
    public function adjust(User $user, int $amount, string $description, User $by): WalletTransaction
    {
        return $this->move($user, $amount, 'adjust', $description, null, null, $by);
    }

    public static function uah(int $kopecks): string
    {
        return rtrim(rtrim(number_format($kopecks / 100, 2, '.', ''), '0'), '.').' ₴';
    }

    private function move(User $user, int $delta, string $type, string $description, ?string $product, ?string $reference, ?User $by): WalletTransaction
    {
        return DB::transaction(function () use ($user, $delta, $type, $description, $product, $reference, $by) {
            $current = (int) User::query()->whereKey($user->id)->lockForUpdate()->value('balance');
            $balance = $current + $delta;
            if ($delta < 0 && $balance < 0) {
                throw new InsufficientFunds(-$balance);
            }
            User::query()->whereKey($user->id)->update(['balance' => $balance]);
            $user->forceFill(['balance' => $balance])->syncOriginalAttribute('balance');

            return WalletTransaction::query()->create([
                'user_id' => $user->id,
                'amount' => $delta,
                'balance_after' => $balance,
                'type' => $type,
                'description' => mb_substr($description, 0, 200),
                'product' => $product,
                'reference' => $reference,
                'by_user_id' => $by?->id,
            ]);
        });
    }
}
