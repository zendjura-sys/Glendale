<?php

namespace App\Services\Billing;

use App\Models\User;
use App\Notifications\AccountNotice;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Підписка на автора (лише сайт) за розрахункові одиниці балансу GameCon: до трьох рівнів, 30 днів,
 * автопродовження з балансу. Автору нараховуються одиниці мінус частка платформи (author_fee_percent);
 * вони витрачаються лише на послуги сайту й не виводяться (Публічна оферта, розділи 8–9).
 * Записи «лише для підписників» бачать підписники, автор і персонал.
 */
class AuthorSubscriptions
{
    public const MAX_TIERS = 3;

    public const DAYS = 30;

    public function __construct(private readonly Wallet $wallet, private readonly SiteSettings $settings) {}

    public function feePercent(): int
    {
        return max(0, min(50, (int) $this->settings->get('author_fee_percent', 10)));
    }

    /**
     * @return list<array{id: int, name: string, price: int, perks: string|null}>
     */
    public function tiers(User $author): array
    {
        return array_values(DB::table('author_tiers')->where('user_id', $author->id)->orderBy('position')->orderBy('price')->get()
            ->map(fn ($t) => ['id' => (int) $t->id, 'name' => (string) $t->name, 'price' => (int) $t->price, 'perks' => $t->perks])->all());
    }

    /**
     * Замінити рівні. Рівні, на які вже є підписники, зберігаються (оновлюються), решта — видаляються.
     *
     * @param  list<array{id?: int|null, name: string, price: int, perks?: string|null}>  $tiers
     */
    public function saveTiers(User $author, array $tiers): void
    {
        if (count($tiers) > self::MAX_TIERS) {
            throw ValidationException::withMessages(['tiers' => 'Можна мати до трьох рівнів.']);
        }
        DB::transaction(function () use ($author, $tiers) {
            $keep = [];
            foreach ($tiers as $i => $tier) {
                $row = ['name' => mb_substr(trim($tier['name']), 0, 40), 'price' => (int) $tier['price'], 'perks' => isset($tier['perks']) ? mb_substr(trim((string) $tier['perks']), 0, 300) : null, 'position' => $i, 'updated_at' => now()];
                $id = isset($tier['id']) ? (int) $tier['id'] : 0;
                if ($id > 0 && DB::table('author_tiers')->where('id', $id)->where('user_id', $author->id)->exists()) {
                    DB::table('author_tiers')->where('id', $id)->update($row);
                } else {
                    $id = (int) DB::table('author_tiers')->insertGetId([...$row, 'user_id' => $author->id, 'created_at' => now()]);
                }
                $keep[] = $id;
            }
            DB::table('author_tiers')->where('user_id', $author->id)->whereNotIn('id', $keep)->delete();
        });
    }

    public function isSubscribed(?User $fan, int $authorId): bool
    {
        return $fan !== null && DB::table('author_subscriptions')->where('user_id', $fan->id)->where('author_id', $authorId)->where('expires_at', '>', now())->exists();
    }

    /**
     * Автори, на яких підписана людина (для перевірки записів у стрічці одним запитом).
     *
     * @return list<int>
     */
    public function authorsFor(User $fan): array
    {
        return array_values(DB::table('author_subscriptions')->where('user_id', $fan->id)->where('expires_at', '>', now())->pluck('author_id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * Оформити (або змінити рівень) на 30 днів. Списується повна ціна, автору — ціна мінус комісія.
     *
     * @throws InsufficientFunds
     */
    public function subscribe(User $fan, int $tierId): void
    {
        $tier = DB::table('author_tiers')->where('id', $tierId)->first();
        abort_if($tier === null, 404);
        $author = User::query()->findOrFail((int) $tier->user_id);
        abort_if($author->id === $fan->id, 422, 'Не можна підписатися на себе.');

        DB::transaction(function () use ($fan, $author, $tier) {
            $this->charge($fan, $author, (int) $tier->price, (string) $tier->name);
            $current = DB::table('author_subscriptions')->where('user_id', $fan->id)->where('author_id', $author->id)->lockForUpdate()->first();
            $from = $current && now()->lt($current->expires_at) ? Carbon::parse($current->expires_at) : now();
            DB::table('author_subscriptions')->updateOrInsert(
                ['user_id' => $fan->id, 'author_id' => $author->id],
                ['tier_id' => $tier->id, 'price' => (int) $tier->price, 'expires_at' => $from->copy()->addDays(self::DAYS), 'auto_renew' => true, 'updated_at' => now(), 'created_at' => $current->created_at ?? now()],
            );
        });
        $author->notify(new AccountNotice('author_sub', $fan, 'Нова підписка: «'.$tier->name.'»', '', '/settings/subscriptions'));
    }

    public function setAutoRenew(User $fan, int $authorId, bool $on): void
    {
        DB::table('author_subscriptions')->where('user_id', $fan->id)->where('author_id', $authorId)->update(['auto_renew' => $on, 'updated_at' => now()]);
    }

    /** Щоденно: продовжити ті, що закінчуються за добу (якщо на рахунку досить), решту — лишити до кінця строку. */
    public function renewDue(): int
    {
        $renewed = 0;
        $due = DB::table('author_subscriptions')->where('auto_renew', true)->whereBetween('expires_at', [now(), now()->addDay()])->get();
        foreach ($due as $sub) {
            $fan = User::query()->whereKey((int) $sub->user_id)->first();
            $author = User::query()->whereKey((int) $sub->author_id)->first();
            $tier = $sub->tier_id ? DB::table('author_tiers')->where('id', $sub->tier_id)->first() : null;
            if (! $fan || ! $author || ! $tier) {
                continue;
            }
            try {
                DB::transaction(function () use ($fan, $author, $tier, $sub) {
                    $this->charge($fan, $author, (int) $tier->price, (string) $tier->name);
                    DB::table('author_subscriptions')->where('id', $sub->id)->update(['price' => (int) $tier->price, 'expires_at' => Carbon::parse($sub->expires_at)->addDays(self::DAYS), 'updated_at' => now()]);
                });
                $renewed++;
            } catch (InsufficientFunds) {
                $fan->notify(new AccountNotice('author_sub', $author, 'Підписку на '.$author->name.' не продовжено — поповніть баланс GameCon', '', '/'.$author->username));
            }
        }

        return $renewed;
    }

    /**
     * @return array{subscribers: int, month: int, total: int, fee: int}
     */
    public function earnings(User $author): array
    {
        $income = DB::table('wallet_transactions')->where('user_id', $author->id)->where('type', 'author_income');

        return [
            'subscribers' => DB::table('author_subscriptions')->where('author_id', $author->id)->where('expires_at', '>', now())->count(),
            'month' => (int) (clone $income)->where('created_at', '>=', now()->startOfMonth())->sum('amount'),
            'total' => (int) $income->sum('amount'),
            'fee' => $this->feePercent(),
        ];
    }

    /** @throws InsufficientFunds */
    private function charge(User $fan, User $author, int $price, string $tierName): void
    {
        $ref = 'author:'.$author->id;
        $this->wallet->debit($fan, $price, 'author_sub', 'Підписка на '.$author->name.' («'.$tierName.'»)', 'author_sub', $ref);
        $net = $price - intdiv($price * $this->feePercent(), 100);
        $this->wallet->credit($author, $net, 'author_income', 'Підписка від '.$fan->name.' («'.$tierName.'»)', 'author_sub', 'fan:'.$fan->id);
    }
}
