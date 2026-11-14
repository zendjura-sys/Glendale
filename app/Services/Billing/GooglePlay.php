<?php

namespace App\Services\Billing;

use App\Models\PhoneNumber;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\PlusSubscription;
use App\Models\User;
use App\Services\Phones\PhoneNumbers;
use App\Services\Phones\PhoneTiers;
use App\Services\Plus\Plus;
use App\Services\Push\FcmClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Підписки GameCon+ у застосунку через Google Play Billing.
 *
 * Застосунок купує підписку (obfuscatedAccountId = accountId() людини) і надсилає токен покупки на сервер.
 * Сервер ніколи не вірить застосунку: стан, строк і власника бере з Google Play Developer API
 * (purchases.subscriptionsv2), підтверджує покупку (acknowledge — інакше Google поверне гроші за 3 дні)
 * і веде період доступу в plus_grants (Plus::syncSubscription). Продовження, скасування й повернення
 * приходять через Real-time developer notifications (Pub/Sub → /billing/google-play/rtdn) і щоденну перевірку.
 *
 * Сервісний акаунт: секрет google_play_service_account (порожньо — ключ Firebase fcm_service_account,
 * якщо цьому акаунту надано доступ у Play Console → Користувачі й дозволи).
 */
class GooglePlay
{
    private const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

    private const TOKEN_CACHE = 'google_play.access_token';

    /** subscriptionState → наш статус. */
    private const STATES = [
        'SUBSCRIPTION_STATE_ACTIVE' => 'active',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' => 'grace',
        'SUBSCRIPTION_STATE_ON_HOLD' => 'on_hold',
        'SUBSCRIPTION_STATE_PAUSED' => 'paused',
        'SUBSCRIPTION_STATE_CANCELED' => 'canceled',
        'SUBSCRIPTION_STATE_EXPIRED' => 'expired',
        'SUBSCRIPTION_STATE_PENDING' => 'pending',
        'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED' => 'expired',
    ];

    public function __construct(private readonly SiteSettings $settings, private readonly Plus $plus) {}

    public function enabled(): bool
    {
        return (bool) $this->settings->get('google_play_enabled') && $this->credentials() !== null && $this->products() !== [];
    }

    public function package(): string
    {
        $value = trim((string) $this->settings->get('google_play_package', ''));

        return $value !== '' ? $value : (string) config('services.google_play.package');
    }

    /**
     * ID підписок у Play Console, які дають GameCon+ (через кому в адмінці).
     *
     * @return list<string>
     */
    public function products(): array
    {
        $raw = (string) ($this->settings->get('google_play_products') ?: 'gamecon_plus');

        return array_values(array_unique(array_filter(array_map('trim', explode(',', $raw)), fn (string $id) => preg_match('/^[a-z0-9][a-z0-9_.]{0,39}$/', $id) === 1)));
    }

    /**
     * @return array{project_id: string, client_email: string, private_key: string, token_uri: string}|null
     */
    public function credentials(): ?array
    {
        $raw = $this->settings->secret('google_play_service_account') ?: $this->settings->secret('fcm_service_account') ?: config('services.google_play.credentials');

        return is_string($raw) && trim($raw) !== '' ? FcmClient::parse($raw) : null;
    }

    /** Секрет в адресі для Pub/Sub push (…/rtdn?token=…); створюється сам при першому зверненні. */
    public function rtdnToken(): string
    {
        $token = $this->settings->secret('google_play_rtdn_token');
        if (! is_string($token) || strlen($token) < 32) {
            $token = bin2hex(random_bytes(24));
            $this->settings->putSecret('google_play_rtdn_token', $token);
        }

        return $token;
    }

    public function rtdnUrl(): string
    {
        return rtrim((string) config('app.url'), '/').'/billing/google-play/rtdn?token='.$this->rtdnToken();
    }

    /**
     * Ідентифікатор акаунта для BillingFlowParams.setObfuscatedAccountId: «u{id}.{підпис}».
     * Без персональних даних; підпис не дає підставити чужий ID.
     */
    public function accountId(User $user): string
    {
        return 'u'.$user->id.'.'.substr(hash_hmac('sha256', 'google-play:'.$user->id, (string) config('app.key')), 0, 24);
    }

    public function userFromAccountId(?string $accountId): ?User
    {
        if (! is_string($accountId) || ! preg_match('/^u(\d{1,20})\.([a-f0-9]{24})$/', $accountId, $m)) {
            return null;
        }
        $user = User::query()->find((int) $m[1]);

        return $user !== null && hash_equals($this->accountId($user), $accountId) ? $user : null;
    }

    /**
     * Номери телефону в застосунку — разові товари Google Play phone_<рівень> (як на сайті, PhoneNumbers::product).
     * Ціну кожного рівня задають у Play Console; знижка GameCon+ діє лише на сайті.
     */
    public function phonesEnabled(): bool
    {
        return (bool) $this->settings->get('google_play_phones_enabled') && $this->credentials() !== null;
    }

    /** @return list<string> */
    public function phoneProducts(): array
    {
        return array_map(fn (string $tier) => PhoneNumbers::product($tier), PhoneTiers::ALL);
    }

    /** Бронь номера для BillingFlowParams.setObfuscatedProfileId: «n{id}.{підпис}». */
    public function holdId(PhoneNumber $number): string
    {
        return 'n'.$number->id.'.'.substr(hash_hmac('sha256', 'google-play-phone:'.$number->id, (string) config('app.key')), 0, 24);
    }

    private function holdFromId(?string $profileId): ?PhoneNumber
    {
        if (! is_string($profileId) || ! preg_match('/^n(\d{1,20})\.([a-f0-9]{24})$/', $profileId, $m)) {
            return null;
        }
        $number = PhoneNumber::query()->find((int) $m[1]);

        return $number !== null && hash_equals($this->holdId($number), $profileId) ? $number : null;
    }

    /**
     * Застосунок купив номер у Google Play: перевіряємо покупку в Developer API (purchases.products),
     * вмикаємо заброньований номер і списуємо покупку (consume). Повтор того самого токена нічого не дублює.
     * Якщо бронь зникла, покупку не підтверджуємо — Google сам поверне гроші за 3 дні.
     *
     * @throws GooglePlayException
     */
    public function purchasePhone(string $token, string $product, User $user, int $amountMicros = 0, string $currency = ''): PhoneNumber
    {
        if (! in_array($product, $this->phoneProducts(), true)) {
            throw new GooglePlayException('Це не товар номера.', 422);
        }
        $hash = PlusSubscription::hashToken($token);
        $paid = PlusPayment::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->where('provider_id', $hash)->first();
        if ($paid !== null) {
            $number = PhoneNumber::query()->where('payment_id', $paid->id)->first();
            if ($paid->user_id !== $user->id || $number === null) {
                throw new GooglePlayException('Цю покупку вже використано.', 409);
            }
            $this->consume($product, $token);

            return $number;
        }

        $response = $this->request('get', '/purchases/products/'.rawurlencode($product).'/tokens/'.rawurlencode($token));
        if (in_array($response['status'], [400, 404, 410], true)) {
            throw new GooglePlayException('Google Play не знає такої покупки.', 422);
        }
        if ($response['status'] !== 200 || ! is_array($response['json'])) {
            throw new GooglePlayException('Google Play тимчасово недоступний. Спробуйте ще раз за хвилину.', 503);
        }
        $data = $response['json'];
        if ((int) ($data['purchaseState'] ?? 1) !== 0) {
            throw new GooglePlayException((int) ($data['purchaseState'] ?? 1) === 2 ? 'Оплата ще не завершена.' : 'Покупку скасовано.', 422);
        }
        $owner = $this->userFromAccountId(is_string($data['obfuscatedExternalAccountId'] ?? null) ? $data['obfuscatedExternalAccountId'] : null);
        if ($owner === null || $owner->id !== $user->id) {
            throw new GooglePlayException('Цю покупку оформлено в іншому акаунті GameCon.', 403);
        }
        $number = $this->holdFromId(is_string($data['obfuscatedExternalProfileId'] ?? null) ? $data['obfuscatedExternalProfileId'] : null);
        if ($number === null || $number->user_id !== $user->id || $number->status !== PhoneNumber::PENDING || PhoneNumbers::product($number->tier) !== $product) {
            Log::warning('google play: phone hold missing', ['user' => $user->id, 'product' => $product, 'order' => $data['orderId'] ?? null]);
            throw new GooglePlayException('Бронь номера минула. Покупку не завершено — Google поверне кошти автоматично.', 409);
        }

        DB::transaction(function () use ($user, $hash, $product, $number, $amountMicros, $currency) {
            $payment = PlusPayment::query()->create([
                'provider' => PlusSubscription::GOOGLE_PLAY,
                'provider_id' => $hash,
                'user_id' => $user->id,
                'product' => $product,
                'target_type' => 'phone',
                'target_id' => $number->id,
                // Сума — як показав Google Play у застосунку (лише для звітів; доступ від неї не залежить).
                'amount' => max(0, intdiv($amountMicros, 10_000)),
                'currency' => preg_match('/^[A-Z]{3}$/', $currency) === 1 ? $currency : 'XXX',
                'status' => PlusPayment::PAID,
            ]);
            app(PhoneNumbers::class)->activate($number, $payment->id);
        });
        $this->consume($product, $token);

        return $number->refresh();
    }

    /** Списати разову покупку (consume = ще й підтвердження), щоб номер можна було купити знову. */
    private function consume(string $product, string $token): void
    {
        $response = $this->request('post', '/purchases/products/'.rawurlencode($product).'/tokens/'.rawurlencode($token).':consume');
        if ($response['status'] >= 300) {
            Log::warning('google play: consume failed', ['product' => $product, 'status' => $response['status']]);
        }
    }

    /**
     * Перевірити токен покупки в Google Play і оновити підписку й доступ.
     * $expected — людина, від імені якої застосунок надіслав токен (null — сповіщення RTDN чи щоденна перевірка).
     *
     * @throws GooglePlayException
     */
    public function sync(string $token, ?User $expected = null): PlusSubscription
    {
        $data = $this->fetch($token);
        $item = collect((array) ($data['lineItems'] ?? []))
            ->first(fn ($line) => is_array($line) && in_array($line['productId'] ?? null, $this->products(), true));
        if (! is_array($item)) {
            throw new GooglePlayException('Ця підписка Google Play не дає GameCon+.', 422);
        }

        $hash = PlusSubscription::hashToken($token);
        $existing = PlusSubscription::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->where('provider_id', $hash)->first();
        $account = $data['externalAccountIdentifiers']['obfuscatedExternalAccountId'] ?? null;
        $owner = $this->userFromAccountId(is_string($account) ? $account : null);
        if ($owner === null && $existing !== null && $existing->user_id !== null) {
            $owner = User::query()->find($existing->user_id);
        }
        if ($owner === null && $account === null) {
            // Покупка без прив’язки до акаунта (стара версія застосунку) — прив’язуємо до того, хто надіслав токен.
            $owner = $expected;
        }
        if ($owner === null) {
            throw new GooglePlayException('Не вдалося визначити акаунт GameCon для цієї покупки.', 422);
        }
        if ($expected !== null && $owner->id !== $expected->id) {
            throw new GooglePlayException('Цю підписку оформлено в іншому акаунті GameCon.', 403);
        }

        $state = self::STATES[(string) ($data['subscriptionState'] ?? '')] ?? 'pending';
        $expiry = isset($item['expiryTime']) ? Carbon::parse((string) $item['expiryTime']) : null;
        $autoRenew = (bool) ($item['autoRenewingPlan']['autoRenewEnabled'] ?? false);
        $entitled = in_array($state, PlusSubscription::ENTITLED, true) && $expiry !== null && $expiry->isFuture();
        // Доступ: до кінця оплаченого періоду; з автопродовженням — із запасом, поки Google проводить платіж.
        $end = $entitled
            ? ($state === 'active' && $autoRenew ? $expiry->copy()->addDays((int) config('plus.grace_days', 3)) : $expiry->copy())
            : now();

        $subscription = DB::transaction(function () use ($existing, $hash, $token, $owner, $item, $data, $state, $expiry, $autoRenew, $end) {
            $subscription = $existing ?? new PlusSubscription(['provider' => PlusSubscription::GOOGLE_PLAY, 'provider_id' => $hash]);
            $subscription->fill([
                'owner_type' => 'user',
                'owner_id' => $owner->id,
                'user_id' => $owner->id,
                'product' => (string) $item['productId'],
                'base_plan' => is_string($item['offerDetails']['basePlanId'] ?? null) ? $item['offerDetails']['basePlanId'] : null,
                'status' => $state,
                'renews_at' => $expiry,
                'ends_at' => $autoRenew && $state === 'active' ? null : $end,
                'purchase_token' => $token,
                'order_id' => is_string($data['latestOrderId'] ?? null) ? substr($data['latestOrderId'], 0, 64) : null,
                'auto_renew' => $autoRenew,
                'is_test' => isset($data['testPurchase']),
                'checked_at' => now(),
            ])->save();

            $this->plus->syncSubscription($owner, $subscription->id, $owner, isset($data['startTime']) ? Carbon::parse((string) $data['startTime']) : null, $end);

            // Перехід на інший план (upgrade/downgrade): стара покупка більше не дає доступу.
            $linked = $data['linkedPurchaseToken'] ?? null;
            if (is_string($linked) && $linked !== '') {
                $old = PlusSubscription::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->where('provider_id', PlusSubscription::hashToken($linked))->first();
                if ($old !== null && $old->id !== $subscription->id) {
                    $old->update(['status' => 'expired', 'ends_at' => now(), 'auto_renew' => false]);
                    PlusGrant::query()->where('subscription_id', $old->id)->update(['ends_at' => now()]);
                    $this->plus->refresh($owner);
                }
            }

            return $subscription;
        });

        if ($entitled && ($data['acknowledgementState'] ?? null) === 'ACKNOWLEDGEMENT_STATE_PENDING') {
            $this->acknowledge($subscription, $token);
        } elseif (($data['acknowledgementState'] ?? null) === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' && $subscription->acknowledged_at === null) {
            $subscription->update(['acknowledged_at' => now()]);
        }

        return $subscription;
    }

    /** Покупку повернуто чи анульовано (voided): доступ знімається одразу, куплений номер звільняється. */
    public function revoke(string $token): void
    {
        $payment = PlusPayment::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->where('provider_id', PlusSubscription::hashToken($token))->first();
        if ($payment !== null) {
            $payment->update(['status' => PlusPayment::REFUNDED]);
            app(PhoneNumbers::class)->revoke($payment->id);

            return;
        }
        $subscription = PlusSubscription::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->where('provider_id', PlusSubscription::hashToken($token))->first();
        if ($subscription === null) {
            return;
        }
        $subscription->update(['status' => 'expired', 'ends_at' => now(), 'auto_renew' => false]);
        PlusGrant::query()->where('subscription_id', $subscription->id)->update(['ends_at' => now()]);
        if ($subscription->user !== null) {
            $this->plus->refresh($subscription->user);
        }
    }

    /** Сервісний акаунт приймається Google (для кнопки «Перевірити» в адмінці). */
    public function test(): bool
    {
        Cache::forget(self::TOKEN_CACHE);

        return $this->accessToken() !== null;
    }

    /**
     * Активна підписка Google Play людини (для статусу в застосунку).
     */
    public function current(User $user): ?PlusSubscription
    {
        return PlusSubscription::query()->where('provider', PlusSubscription::GOOGLE_PLAY)->where('user_id', $user->id)
            ->whereIn('status', PlusSubscription::ENTITLED)->where('renews_at', '>', now())->latest('renews_at')->first();
    }

    /** Сторінка керування підпискою в Google Play (скасування, зміна способу оплати). */
    public function manageUrl(PlusSubscription $subscription): string
    {
        return 'https://play.google.com/store/account/subscriptions?'.http_build_query(['sku' => $subscription->product, 'package' => $this->package()]);
    }

    /**
     * @return array<string, mixed>
     *
     * @throws GooglePlayException
     */
    private function fetch(string $token): array
    {
        $response = $this->request('get', '/purchases/subscriptionsv2/tokens/'.rawurlencode($token));
        if (in_array($response['status'], [400, 404, 410], true)) {
            throw new GooglePlayException('Google Play не знає такої покупки.', 422);
        }
        if ($response['status'] !== 200 || ! is_array($response['json'])) {
            throw new GooglePlayException('Google Play тимчасово недоступний. Спробуйте ще раз за хвилину.', 503);
        }

        return $response['json'];
    }

    private function acknowledge(PlusSubscription $subscription, string $token): void
    {
        $response = $this->request('post', '/purchases/subscriptions/'.rawurlencode($subscription->product).'/tokens/'.rawurlencode($token).':acknowledge');
        if ($response['status'] >= 200 && $response['status'] < 300) {
            $subscription->update(['acknowledged_at' => now()]);
        } else {
            // Не страшно: наступна перевірка (RTDN чи щоденна) спробує ще раз — у Google на це 3 дні.
            Log::warning('google play: acknowledge failed', ['subscription' => $subscription->id, 'status' => $response['status']]);
        }
    }

    /**
     * @return array{status: int, json: mixed}
     *
     * @throws GooglePlayException
     */
    private function request(string $method, string $path): array
    {
        $access = $this->accessToken();
        if ($access === null) {
            throw new GooglePlayException('Google Play не налаштовано: немає ключа сервісного акаунта.', 503);
        }
        $url = rtrim((string) config('services.google_play.url'), '/').'/androidpublisher/v3/applications/'.rawurlencode($this->package()).$path;
        try {
            $response = Http::timeout(15)->withToken($access)->acceptJson()->{$method}($url);
        } catch (ConnectionException) {
            throw new GooglePlayException('Google Play не відповідає. Спробуйте ще раз за хвилину.', 503);
        }
        if ($response->status() === 401) {
            Cache::forget(self::TOKEN_CACHE);
        }
        if ($response->status() === 403) {
            throw new GooglePlayException('Сервісний акаунт не має доступу до застосунку в Play Console.', 503);
        }

        return ['status' => $response->status(), 'json' => $response->json()];
    }

    private function accessToken(): ?string
    {
        $cached = Cache::get(self::TOKEN_CACHE);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }
        $credentials = $this->credentials();
        if ($credentials === null) {
            return null;
        }

        $now = time();
        $segments = [
            self::base64url((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT'])),
            self::base64url((string) json_encode([
                'iss' => $credentials['client_email'],
                'scope' => self::SCOPE,
                'aud' => $credentials['token_uri'],
                'iat' => $now,
                'exp' => $now + 3600,
            ])),
        ];
        $key = openssl_pkey_get_private($credentials['private_key']);
        if ($key === false || ! openssl_sign(implode('.', $segments), $signature, $key, OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $segments[] = self::base64url($signature);

        try {
            $response = Http::asForm()->timeout(10)->post($credentials['token_uri'], [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => implode('.', $segments),
            ]);
        } catch (ConnectionException) {
            return null;
        }
        $token = $response->json('access_token');
        if (! $response->successful() || ! is_string($token) || $token === '') {
            return null;
        }
        Cache::put(self::TOKEN_CACHE, $token, now()->addSeconds(max(60, (int) $response->json('expires_in', 3600) - 300)));

        return $token;
    }

    private static function base64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
