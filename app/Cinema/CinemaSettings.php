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

    public const KODIK_CURSOR = 'cinema_kodik_cursor';

    public const KODIK_IMPORT_POLICY = 'cinema_kodik_import_policy';

    /** Другий балансер плеєрів (uacdn.live) — працює паралельно з Kodik, не замість нього. */
    public const FLIXCDN_TOKEN = 'cinema_flixcdn_token';

    public const LANGUAGE = 'cinema_language';

    /** Ключ доступу для мосту CineCon (нативний Android-клієнт, апikey-заголовок). */
    public const FLIXY_API_KEY = 'cinema_flixy_api_key';

    /** tmdb_id, які cinema:auto-import ніколи не бере в чергу (ручний імпорт за посиланням це не обмежує). */
    public const BLACKLIST = 'cinema_blacklist';

    /** Молодший за цей рік — автоімпорт пропускає (ручний імпорт це не обмежує). */
    public const MIN_YEAR = 'cinema_min_year';

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

    public static function kodikCursor(): ?string
    {
        $value = Setting::get(self::KODIK_CURSOR);

        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function setKodikCursor(?string $cursor): void
    {
        Setting::set(self::KODIK_CURSOR, $cursor ?: null, 'cinema');
    }

    public static function kodikScanWatermark(): ?string
    {
        $value = Setting::get('cinema_kodik_scan_watermark');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function setKodikScanWatermark(?string $value): void
    {
        Setting::set('cinema_kodik_scan_watermark', $value, 'cinema');
    }

    public static function kodikWatermark(): ?string
    {
        $value = Setting::get('cinema_kodik_watermark');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function setKodikWatermark(string $value): void
    {
        Setting::set('cinema_kodik_watermark', $value, 'cinema');
    }

    /** @return array<string, mixed> */
    public static function kodikImportPolicy(): array
    {
        $decoded = json_decode((string) Setting::get(self::KODIK_IMPORT_POLICY, '{}'), true);

        return is_array($decoded) ? $decoded : [];
    }

    /** @param array<string, mixed> $settings */
    public static function setKodikImportPolicy(array $settings): void
    {
        Setting::set(
            self::KODIK_IMPORT_POLICY,
            json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'cinema',
        );
    }

    public static function flixcdnToken(): ?string
    {
        return self::secret(self::FLIXCDN_TOKEN);
    }

    public static function language(): string
    {
        return Setting::get(self::LANGUAGE) ?: 'uk-UA';
    }

    /** Ключ задається в адмінці або через конфігурацію середовища. */
    public static function flixyApiKey(): string
    {
        return self::secret(self::FLIXY_API_KEY) ?? (string) config('services.flixy.api_key', '');
    }

    /** @return list<int> */
    public static function blacklist(): array
    {
        $raw = (string) Setting::get(self::BLACKLIST, '');

        return array_values(array_unique(array_filter(array_map('intval', preg_split('/[\s,]+/', $raw, -1, PREG_SPLIT_NO_EMPTY) ?: []))));
    }

    public static function blacklistText(): string
    {
        return (string) Setting::get(self::BLACKLIST, '');
    }

    public static function minYear(): ?int
    {
        $value = Setting::get(self::MIN_YEAR);

        return $value !== null && $value !== '' ? (int) $value : null;
    }
}

