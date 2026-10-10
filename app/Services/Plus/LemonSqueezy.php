<?php

namespace App\Services\Plus;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Lemon Squeezy — продавець від свого імені (Merchant of Record): податки й чеки на їхньому боці,
 * тож продавати можна без ФОП. Тут лише створення посилання на оплату й перевірка вебхуків.
 */
class LemonSqueezy
{
    public const PROVIDER = 'lemonsqueezy';

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->key() !== null && filled($this->settings->get('lemonsqueezy_store_id'));
    }

    /** ID варіанта товару в Lemon Squeezy для нашого товару (plus_month, promo_top_7…). */
    public function variant(string $product): ?string
    {
        $id = $this->settings->get('ls_variant_'.$product);

        return is_scalar($id) && (string) $id !== '' ? (string) $id : null;
    }

    /** Наш товар за ID варіанта з вебхука. */
    public function productForVariant(string $variant): ?string
    {
        foreach (array_keys((array) config('plus.products')) as $product) {
            if ($this->variant((string) $product) === $variant) {
                return (string) $product;
            }
        }

        return null;
    }

    public function available(string $product): bool
    {
        return $this->configured() && $this->variant($product) !== null;
    }

    /**
     * Посилання на сторінку оплати. custom — повертається у вебхуках як meta.custom_data.
     *
     * @param  array<string, string>  $custom
     */
    public function checkout(string $product, User $payer, array $custom, string $redirect): ?string
    {
        $variant = $this->variant($product);
        if (! $this->configured() || $variant === null) {
            return null;
        }

        try {
            $response = $this->http()->post('/v1/checkouts', [
                'data' => [
                    'type' => 'checkouts',
                    'attributes' => [
                        'checkout_data' => [
                            'email' => $payer->email,
                            'name' => $payer->name,
                            'custom' => ['product' => $product, 'user_id' => (string) $payer->id, ...$custom],
                        ],
                        'product_options' => ['redirect_url' => $redirect],
                        'checkout_options' => ['embed' => false],
                        'test_mode' => (bool) $this->settings->get('lemonsqueezy_test_mode'),
                    ],
                    'relationships' => [
                        'store' => ['data' => ['type' => 'stores', 'id' => (string) $this->settings->get('lemonsqueezy_store_id')]],
                        'variant' => ['data' => ['type' => 'variants', 'id' => $variant]],
                    ],
                ],
            ]);
        } catch (Throwable $e) {
            report($e);

            return null;
        }
        $url = $response->json('data.attributes.url');

        return $response->successful() && is_string($url) ? $url : null;
    }

    /** Підпис X-Signature: HMAC-SHA256 сирого тіла запиту секретом вебхука. */
    public function verify(string $body, ?string $signature): bool
    {
        $secret = $this->settings->secret('lemonsqueezy_webhook_secret');
        if ($secret === null || $signature === null || $signature === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $body, $secret), $signature);
    }

    /** «Перевірити» в адмінці: ключ працює і магазин із таким ID існує. */
    public function test(): bool
    {
        if (! $this->configured()) {
            return false;
        }

        try {
            return $this->http()->get('/v1/stores/'.rawurlencode((string) $this->settings->get('lemonsqueezy_store_id')))->successful();
        } catch (Throwable) {
            return false;
        }
    }

    private function key(): ?string
    {
        return $this->settings->secret('lemonsqueezy_api_key');
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl((string) config('services.lemonsqueezy.url', 'https://api.lemonsqueezy.com'))
            ->withToken((string) $this->key())
            ->accept('application/vnd.api+json')
            ->contentType('application/vnd.api+json')
            ->timeout(15);
    }
}
