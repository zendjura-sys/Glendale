<?php

namespace App\Services\Billing;

use App\Models\User;
use App\Models\UserCosmetic;
use App\Services\Quests\SeasonPass;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Магазин оформлення (№255): рамки, кольори ніку, значки й ефекти шапки — назавжди, за баланс
 * GameCon. Куплене лягає в той самий інвентар, що й нагороди сезону (UserCosmetic), і вдягається
 * так само. Лише сайт: у застосунку купують тільки через Google Play.
 */
class CosmeticsShop
{
    public function __construct(private readonly SeasonPass $season, private readonly Wallet $wallet) {}

    /**
     * Вітрина з цінами, «куплено» й «вдягнуто».
     *
     * @return list<array<string, mixed>>
     */
    public function catalog(?User $user): array
    {
        $owned = $user ? UserCosmetic::query()->where('user_id', $user->id)->get(['type', 'value'])
            ->map(fn (UserCosmetic $c) => $c->type.':'.$c->value)->all() : [];
        $equipped = $user && is_array($user->cosmetics) ? $user->cosmetics : [];
        $out = [];
        foreach ((array) config('shop.items') as $key => $price) {
            [$type, $value] = explode(':', (string) $key, 2) + [1 => ''];
            $item = $this->season->reward(['type' => $type, 'value' => $value]);
            if ($item === null) {
                continue;
            }
            $out[] = [
                ...$item,
                'key' => (string) $key,
                'price' => (int) $price,
                'owned' => in_array($key, $owned, true),
                'equipped' => ($equipped[$type] ?? null) === $value,
            ];
        }

        return $out;
    }

    /** Купити за баланс (InsufficientFunds — не вистачає). */
    public function buy(User $user, string $key): void
    {
        $price = config("shop.items.{$key}");
        [$type, $value] = explode(':', $key, 2) + [1 => ''];
        if (! is_int($price) || $this->season->reward(['type' => $type, 'value' => $value]) === null) {
            throw ValidationException::withMessages(['item' => 'Такого оформлення в магазині немає.']);
        }
        if (UserCosmetic::query()->where('user_id', $user->id)->where('type', $type)->where('value', $value)->exists()) {
            throw ValidationException::withMessages(['item' => 'Це оформлення вже у вас є.']);
        }

        DB::transaction(function () use ($user, $type, $value, $price, $key) {
            $this->wallet->debit($user, $price * 100, 'purchase', 'Магазин оформлення: '.$this->season->reward(['type' => $type, 'value' => $value])['name'], 'shop:'.$key);
            UserCosmetic::query()->create(['user_id' => $user->id, 'type' => $type, 'value' => $value, 'source' => 'shop']);
        });
        // Купили — одразу вдягаємо (зняти чи змінити можна в магазині чи сезоні).
        $this->season->equip($user, $type, $value);
    }
}
