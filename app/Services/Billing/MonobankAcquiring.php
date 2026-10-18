<?php

namespace App\Services\Billing;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Інтернет-еквайринг monobank (https://monobank.ua/api-docs/acquiring).
 *
 * Токен мерчанта (X-Token) — секрет `monobank_acquiring_token` (Адмінка → Інтеграції → monobank),
 * запасний — MONOBANK_ACQUIRING_TOKEN у .env. Суми — у копійках, валюта — 980 (гривня).
 * Вебхуки підписані ECDSA (P-256, SHA-256): заголовок X-Sign — base64 підпису тіла, ключ — GET /api/merchant/pubkey.
 */
class MonobankAcquiring
{
    public const UAH = 980;

    /** Статуси рахунку. */
    public const CREATED = 'created';

    public const PROCESSING = 'processing';

    public const HOLD = 'hold';

    public const SUCCESS = 'success';

    public const FAILURE = 'failure';

    public const REVERSED = 'reversed';

    public const EXPIRED = 'expired';

    public function __construct(private readonly SiteSettings $settings) {}

    public function token(): ?string
    {
        $token = $this->settings->secret('monobank_acquiring_token') ?: config('services.monobank_acquiring.token');

        return is_string($token) && $token !== '' ? $token : null;
    }

    public function configured(): bool
    {
        return $this->token() !== null;
    }

    /**
     * Рахунок на оплату: повертає invoiceId і pageUrl сторінки оплати monobank
     * (картка, Apple Pay, Google Pay, оплата в застосунку monobank).
     *
     * @param  array{reference: string, destination: string, basket?: list<array<string, mixed>>, comment?: string}  $info
     * @return array{invoiceId: string, pageUrl: string}
     */
    public function createInvoice(int $amount, array $info, string $redirectUrl, string $webhookUrl, int $validitySeconds, ?string $walletId = null): array
    {
        $body = array_filter([
            'amount' => $amount,
            'ccy' => self::UAH,
            'merchantPaymInfo' => array_filter([
                'reference' => $info['reference'],
                'destination' => $info['destination'],
                'comment' => $info['comment'] ?? null,
                'basketOrder' => $info['basket'] ?? null,
            ]),
            'redirectUrl' => $redirectUrl,
            'webHookUrl' => $webhookUrl,
            'validity' => max(60, $validitySeconds),
            'paymentType' => 'debit',
            // Токенізація картки для автопродовження: одна людина — один гаманець.
            'saveCardData' => $walletId !== null ? ['saveCard' => true, 'walletId' => $walletId] : null,
        ], fn ($v) => $v !== null);

        $data = $this->json($this->http()->post('/api/merchant/invoice/create', $body));
        if (! is_string($data['invoiceId'] ?? null) || ! is_string($data['pageUrl'] ?? null)) {
            throw new MonobankException('monobank не повернув посилання на оплату.');
        }

        return ['invoiceId' => $data['invoiceId'], 'pageUrl' => $data['pageUrl']];
    }

    /**
     * Дані мерчанта (перевірка токена в адмінці).
     *
     * @return array{merchantId: string, merchantName: string}|null
     */
    public function details(): ?array
    {
        $data = $this->json($this->http()->get('/api/merchant/details'));

        return is_string($data['merchantId'] ?? null) ? ['merchantId' => $data['merchantId'], 'merchantName' => (string) ($data['merchantName'] ?? '')] : null;
    }

    /**
     * Стан рахунку (той самий формат, що у вебхуку).
     *
     * @return array<string, mixed>
     */
    public function status(string $invoiceId): array
    {
        return $this->json($this->http()->get('/api/merchant/invoice/status', ['invoiceId' => $invoiceId]));
    }

    /**
     * Повернення коштів на картку (повне або часткове, копійки).
     *
     * @return array<string, mixed>
     */
    public function cancel(string $invoiceId, ?int $amount = null, ?string $extRef = null): array
    {
        return $this->json($this->http()->post('/api/merchant/invoice/cancel', array_filter([
            'invoiceId' => $invoiceId,
            'amount' => $amount,
            'extRef' => $extRef,
        ], fn ($v) => $v !== null)));
    }

    /** Скасувати ще не оплачений рахунок. */
    public function remove(string $invoiceId): void
    {
        $this->json($this->http()->post('/api/merchant/invoice/remove', ['invoiceId' => $invoiceId]));
    }

    /**
     * Збережені картки гаманця людини.
     *
     * @return list<array{cardToken: string, maskedPan: string, country: string|null}>
     */
    public function cards(string $walletId): array
    {
        $data = $this->json($this->http()->get('/api/merchant/wallet', ['walletId' => $walletId]));
        $out = [];
        foreach ((array) ($data['wallet'] ?? []) as $card) {
            if (is_array($card) && is_string($card['cardToken'] ?? null)) {
                $out[] = ['cardToken' => $card['cardToken'], 'maskedPan' => (string) ($card['maskedPan'] ?? ''), 'country' => $card['country'] ?? null];
            }
        }

        return $out;
    }

    public function deleteCard(string $cardToken): void
    {
        $response = $this->http()->delete('/api/merchant/wallet/card?'.http_build_query(['cardToken' => $cardToken]));
        if ($response->status() !== 404) {
            $this->json($response);
        }
    }

    /**
     * Оплата токеном: збережена картка (cardToken, initiationKind=merchant — автопродовження без участі людини)
     * або Google Pay / Apple Pay (aToken, initiationKind=client). tdsUrl у відповіді — перевірка 3-D Secure.
     *
     * @param  array{cardToken?: string, aToken?: string}  $source
     * @param  array{reference: string, destination: string, basket?: list<array<string, mixed>>}  $info
     * @return array<string, mixed>
     */
    public function walletPayment(array $source, int $amount, array $info, string $initiationKind, string $webhookUrl, ?string $redirectUrl = null): array
    {
        $body = array_filter([
            'cardToken' => $source['cardToken'] ?? null,
            'aToken' => $source['aToken'] ?? null,
            'amount' => $amount,
            'ccy' => self::UAH,
            'initiationKind' => $initiationKind,
            'paymentType' => 'debit',
            'redirectUrl' => $redirectUrl,
            'webHookUrl' => $webhookUrl,
            'merchantPaymInfo' => array_filter([
                'reference' => $info['reference'],
                'destination' => $info['destination'],
                'basketOrder' => $info['basket'] ?? null,
            ]),
        ], fn ($v) => $v !== null);

        return $this->json($this->http()->post('/api/merchant/wallet/payment', $body));
    }

    /**
     * Підпис вебхука. Ключ кешується; якщо підпис не сходиться — ключ перечитується один раз (банк міг його змінити).
     */
    public function verify(string $body, ?string $signature): bool
    {
        if ($signature === null || $signature === '') {
            return false;
        }
        $raw = base64_decode($signature, true);
        if ($raw === false) {
            return false;
        }
        foreach ([false, true] as $refresh) {
            $pem = $this->publicKey($refresh);
            if ($pem !== null && openssl_verify($body, $raw, $pem, OPENSSL_ALGO_SHA256) === 1) {
                return true;
            }
        }

        return false;
    }

    private function publicKey(bool $refresh): ?string
    {
        if ($refresh) {
            Cache::forget('monobank.acquiring.pubkey');
        }

        return Cache::remember('monobank.acquiring.pubkey', now()->addDay(), function () {
            try {
                $key = $this->json($this->http()->get('/api/merchant/pubkey'))['key'] ?? null;
            } catch (MonobankException $e) {
                Log::warning('monobank pubkey', ['error' => $e->getMessage()]);

                return null;
            }
            // Банк віддає base64 від PEM-блоку «PUBLIC KEY».
            $pem = is_string($key) ? base64_decode($key, true) : false;

            return is_string($pem) && str_contains($pem, 'PUBLIC KEY') ? $pem : null;
        });
    }

    private function http(): PendingRequest
    {
        $token = $this->token();
        if ($token === null) {
            throw new MonobankException('Еквайринг monobank не налаштовано.');
        }

        return Http::baseUrl(rtrim((string) config('services.monobank_acquiring.url'), '/'))
            ->withHeaders(['X-Token' => $token])
            ->acceptJson()
            ->timeout(20);
    }

    /**
     * @return array<string, mixed>
     */
    private function json(Response $response): array
    {
        if ($response->failed()) {
            $error = $response->json('errText') ?? $response->json('errorDescription') ?? $response->json('message');
            Log::warning('monobank acquiring', ['status' => $response->status(), 'error' => $error, 'code' => $response->json('errCode')]);
            throw new MonobankException(match (true) {
                $response->status() === 403 => 'monobank відхилив токен еквайрингу. Перевірте його в Адмінка → Інтеграції.',
                is_string($error) && $error !== '' => 'monobank: '.$error,
                default => 'monobank тимчасово недоступний. Спробуйте пізніше.',
            });
        }
        $data = $response->json();

        return is_array($data) ? $data : [];
    }
}
