<?php

namespace App\Cinema;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;

/**
 * Ключі кінопорталу — в адмінці (Кінопортал → Налаштування), у базі
 * зашифровані (APP_KEY): токен Kodik і ключ TMDB не лежать відкритим
 * текстом ні в налаштуваннях, ні в резервних копіях бази.
 */
final class CinemaSettings
{
    public const TMDB_KEY = 'cinema_tmdb_key';

    public const KODIK_TOKEN = 'cinema_kodik_token';

    /** Другий балансер плеєрів (uacdn.live) — працює паралельно з Kodik, не замість нього. */
    public const FLIXCDN_TOKEN = 'cinema_flixcdn_token';

    public const LANGUAGE = 'cinema_language';

    /** Ключ доступу для мосту CineCon (нативний Android-клієнт, апikey-заголовок). */
    public const FLIXY_API_KEY = 'cinema_flixy_api_key';

    public static function secret(string $key): ?string
    {
        $raw = Setting::get($key);
        if ($raw === null || $raw === '') {
            return null;
        }
        try {
            return Crypt::decryptString($raw);
        } catch (\Throwable) {
            return null;
        }
    }

    public static function setSecret(string $key, ?string $value): void
    {
        $value = $value !== null ? trim($value) : null;
        Setting::set($key, $value ? Crypt::encryptString($value) : null, 'cinema');
    }

    public static function tmdbKey(): ?string
    {
        return self::secret(self::TMDB_KEY);
    }

    public static function kodikToken(): ?string
    {
        return self::secret(self::KODIK_TOKEN);
    }

    public static function flixcdnToken(): ?string
    {
        return self::secret(self::FLIXCDN_TOKEN);
    }

    public static function language(): string
    {
        return Setting::get(self::LANGUAGE) ?: 'uk-UA';
    }

    /**
     * Значення за замовчуванням, як у самого CineCon (Const.API_KEY) —
     * без цього значення застосунок і сервер не змогли б домовитись про
     * ключ ще до першого запуску адмінки. Адмін може перевизначити його
     * тут (тоді треба перезібрати застосунок із новим значенням).
     */
    public static function flixyApiKey(): string
    {
        return self::secret(self::FLIXY_API_KEY) ?? 'cinecon-bridge-2026';
    }
}
