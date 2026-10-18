<?php

namespace App\Services\Billing;

use App\Support\Settings\SiteSettings;

/**
 * Нативна кнопка Google Pay на сайті (поверх сторінки оплати monobank, де Google Pay і так є).
 *
 * Налаштування — Адмінка → Білінг → «Google Pay»: середовище TEST/PRODUCTION, Merchant ID з Google Pay & Wallet
 * Console, шлюз токенізації (gateway) і gatewayMerchantId, які видає monobank. Токен з Google Pay сервер передає
 * в monobank (POST /api/merchant/wallet/payment, поле aToken).
 */
class GooglePay
{
    public const DEFAULTS = [
        'enabled' => false,
        'environment' => 'TEST',
        'merchant_id' => null,
        'merchant_name' => 'GameCon',
        'gateway' => 'monobank',
        'gateway_merchant_id' => null,
    ];

    public function __construct(private readonly SiteSettings $settings, private readonly Checkout $checkout) {}

    /**
     * @return array{enabled: bool, environment: string, merchant_id: string|null, merchant_name: string, gateway: string, gateway_merchant_id: string|null}
     */
    public function settings(): array
    {
        $saved = (array) $this->settings->get('google_pay', []);
        $out = self::DEFAULTS;
        foreach ($out as $key => $default) {
            if (array_key_exists($key, $saved) && $saved[$key] !== null && $saved[$key] !== '') {
                $out[$key] = is_bool($default) ? (bool) $saved[$key] : (string) $saved[$key];
            }
        }
        $out['environment'] = $out['environment'] === 'PRODUCTION' ? 'PRODUCTION' : 'TEST';

        return $out;
    }

    /** Кнопку показуємо, коли її ввімкнули, еквайринг працює, а для бойового середовища є Merchant ID. */
    public function enabled(): bool
    {
        $s = $this->settings();

        return $s['enabled'] && $this->checkout->available() && filled($s['gateway_merchant_id'])
            && ($s['environment'] === 'TEST' || filled($s['merchant_id']));
    }

    /**
     * Налаштування для pay.js на клієнті (без секретів).
     *
     * @return array{environment: string, merchant_id: string|null, merchant_name: string, gateway: string, gateway_merchant_id: string|null, networks: list<string>}|null
     */
    public function clientConfig(): ?array
    {
        if (! $this->enabled()) {
            return null;
        }
        $s = $this->settings();

        return [
            'environment' => $s['environment'],
            'merchant_id' => $s['merchant_id'],
            'merchant_name' => $s['merchant_name'],
            'gateway' => $s['gateway'],
            'gateway_merchant_id' => $s['gateway_merchant_id'],
            'networks' => ['VISA', 'MASTERCARD'],
        ];
    }
}
