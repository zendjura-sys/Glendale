<?php

namespace App\Support;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * Тонка обгортка над pragmarx/google2fa — щоб і форма входу (виклик коду),
 * і налаштування в профілі користувались тим самим кодом перевірки, а не
 * двома трохи різними копіями.
 */
class TwoFactorAuthentication
{
    private Google2FA $engine;

    public function __construct()
    {
        $this->engine = new Google2FA();
    }

    public function generateSecretKey(): string
    {
        return $this->engine->generateSecretKey();
    }

    public function verify(string $secret, string $code): bool
    {
        // window=1 — приймає код за попередні/наступні 30 секунд: без
        // цього різниця годинника на телефоні на кілька секунд означала б
        // "невірний код" навіть із правильним застосунком-аутентифікатором.
        return $this->engine->verifyKey($secret, $code, 1);
    }

    /** SVG QR-код будується локально (bacon/bacon-qr-code) — секрет ніколи не йде на сторонній сервіс. */
    public function qrCodeSvg(User $user, string $secret): string
    {
        $qrUrl = $this->engine->getQRCodeUrl(
            config('app.name', 'GameConnect'),
            $user->email,
            $secret,
        );

        $renderer = new ImageRenderer(new RendererStyle(200), new SvgImageBackEnd());

        return (new Writer($renderer))->writeString($qrUrl);
    }

    /** @return array<int, string> */
    public function generateRecoveryCodes(int $count = 8): array
    {
        return collect()->times($count, fn () => Str::random(10).'-'.Str::random(10))->all();
    }

    /** Ім'я cookie з токеном довіреного пристрою. */
    public const TRUST_COOKIE = 'two_factor_remember';

    private const TRUST_DAYS = 30;

    /**
     * Позначає ЦЕЙ браузер довіреним на TRUST_DAYS — повторний вхід з
     * нього не питатиме код, доки термін не спливе чи пристрій не забудуть
     * вручну. У базі лежить лише sha256 токена (як remember_token), сам
     * токен — тільки в httpOnly cookie: навіть витік бази не дає готового
     * пропуска повз 2FA.
     */
    public function trustDevice(User $user): string
    {
        $token = Str::random(64);

        $devices = $this->activeTrustedDevices($user);
        $devices[] = [
            'hash' => hash('sha256', $token),
            'expires_at' => now()->addDays(self::TRUST_DAYS)->toIso8601String(),
        ];

        $user->forceFill(['two_factor_trusted_devices' => $devices])->save();

        return $token;
    }

    /** Токен із cookie довіряти можна лише якщо його хеш є в НЕпростроченому списку саме цього юзера. */
    public function isDeviceTrusted(User $user, ?string $token): bool
    {
        if (! $token) {
            return false;
        }

        $hash = hash('sha256', $token);

        foreach ($this->activeTrustedDevices($user) as $device) {
            if (hash_equals($device['hash'], $hash)) {
                return true;
            }
        }

        return false;
    }

    public function forgetAllTrustedDevices(User $user): void
    {
        $user->forceFill(['two_factor_trusted_devices' => []])->save();
    }

    public function trustedDeviceCount(User $user): int
    {
        return count($this->activeTrustedDevices($user));
    }

    /**
     * Список без прострочених записів — заразом і чистить їх у базі при
     * кожній перевірці, окрема команда очищення для цього не потрібна.
     *
     * @return array<int, array{hash:string, expires_at:string}>
     */
    private function activeTrustedDevices(User $user): array
    {
        $devices = collect($user->two_factor_trusted_devices ?? [])
            ->filter(fn (array $d) => isset($d['hash'], $d['expires_at']) && now()->lt($d['expires_at']))
            ->values()
            ->all();

        return $devices;
    }
}
