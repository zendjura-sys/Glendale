<?php

namespace App\Services\Plus;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Laravel\Paddle\Cashier;
use Throwable;

/**
 * Paddle Billing v2 (через laravel/cashier-paddle). Paddle — продавець від свого імені (Merchant of Record):
 * приймає оплату, сплачує податки й видає чеки, тож сайту не потрібен ФОП чи власний еквайринг.
 *
 * Ключі беруться з Адмінка → Інтеграції → «Оплата (Paddle)»; .env (PADDLE_*) — запасний варіант.
 * Наші товари (plus_month, gift_year, promo_top_7…) прив’язані до Price ID з кабінету Paddle (pri_…).
 */
class Paddle
{
    public const PROVIDER = 'paddle';

    /** Тип підписки Cashier для особистого GameCon+. Сімейна — «family:{id}» у лідера. */
    public const PERSONAL = 'default';

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * Переносить ключі з налаштувань сайту в config('cashier.*') — Cashier читає лише конфіг.
     * Викликається в AppServiceProvider::boot() і після збереження ключів в адмінці.
     */
    public function applyConfig(): void
    {
        try {
            $this->copySettings();
        } catch (Throwable) {
            // Кеш чи база ще недоступні (встановлення, міграції) — лишаються значення з .env.
        }
    }

    private function copySettings(): void
    {
        $map = [
            'cashier.seller_id' => $this->settings->get('paddle_seller_id'),
            'cashier.client_side_token' => $this->settings->get('paddle_client_token'),
            'cashier.api_key' => $this->settings->secret('paddle_api_key'),
            'cashier.webhook_secret' => $this->settings->secret('paddle_webhook_secret'),
        ];
        foreach ($map as $key => $value) {
            if (filled($value)) {
                config([$key => $value]);
            }
        }
        if ($this->settings->get('paddle_sandbox') !== null) {
            config(['cashier.sandbox' => (bool) $this->settings->get('paddle_sandbox')]);
        }
    }

    public function configured(): bool
    {
        return filled(config('cashier.api_key')) && filled(config('cashier.client_side_token'));
    }

    public function sandbox(): bool
    {
        return (bool) config('cashier.sandbox');
    }

    /** Price ID Paddle для нашого товару. */
    public function price(string $product): ?string
    {
        $id = $this->settings->get('paddle_price_'.$product);

        return is_string($id) && str_starts_with($id, 'pri_') ? $id : null;
    }

    /** Наш товар за Price ID з вебхука. */
    public function productForPrice(?string $price): ?string
    {
        if ($price === null) {
            return null;
        }
        foreach (array_keys((array) config('plus.products')) as $product) {
            if ($this->price((string) $product) === $price) {
                return (string) $product;
            }
        }

        return null;
    }

    public function available(string $product): bool
    {
        return $this->configured() && $this->price($product) !== null;
    }

    /**
     * Створює транзакцію в Paddle й повертає її ID — фронтенд відкриває чекаут Paddle.js саме за ним
     * (transactionId). Товар і custom_data задає сервер, тож у браузері їх не підмінити.
     *
     * @param  array<string, string>  $custom
     */
    public function transaction(string $product, User $payer, array $custom): ?string
    {
        $price = $this->price($product);
        if (! $this->configured() || $price === null) {
            return null;
        }

        try {
            $customer = $payer->createAsCustomer();
            $data = Cashier::api('POST', 'transactions', [
                'items' => [['price_id' => $price, 'quantity' => 1]],
                'customer_id' => $customer->paddle_id,
                'custom_data' => ['product' => $product, 'user_id' => (string) $payer->id, ...$custom],
                'collection_mode' => 'automatic',
            ])->json('data');
        } catch (Throwable $e) {
            report($e);

            return null;
        }

        return is_array($data) && is_string($data['id'] ?? null) ? $data['id'] : null;
    }

    /**
     * Посилання на портал покупця Paddle: картки, чеки, скасування (для «Керувати оплатою»).
     */
    public function portal(User $user): ?string
    {
        $customer = $user->customer;
        if ($customer === null || ! $this->configured()) {
            return null;
        }

        try {
            $url = Cashier::api('POST', 'customers/'.$customer->getAttribute('paddle_id').'/portal-sessions')->json('data.urls.general.overview');
        } catch (Throwable $e) {
            report($e);

            return null;
        }

        return is_string($url) ? $url : null;
    }

    /** «Перевірити» в адмінці: ключ API працює. */
    public function test(): bool
    {
        if (! $this->configured()) {
            return false;
        }

        try {
            return Cashier::api('GET', 'event-types')->successful();
        } catch (Throwable) {
            return false;
        }
    }
}
