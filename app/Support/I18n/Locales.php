<?php

namespace App\Support\I18n;

use App\Models\User;
use App\Services\Geo\VisitorCountry;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Request;
use Locale;

/**
 * Мови сайту й застосунку. Українська — мова-джерело, увімкнена завжди.
 * Решта — у налаштуваннях (Адмінка → Мови): код BCP 47 («en», «pt-BR»), увімкнено чи ні.
 * Мова відвідувача: вибір у профілі → cookie → заголовок застосунку → мова браузера → типова.
 */
class Locales
{
    public const SOURCE = 'uk';

    public const COOKIE = 'locale';

    /** Основна мова країни — для гостей, у яких браузер англійською. */
    public const COUNTRY_LANGUAGES = [
        'UA' => 'uk', 'PL' => 'pl', 'DE' => 'de', 'AT' => 'de', 'CH' => 'de', 'LI' => 'de',
        'FR' => 'fr', 'BE' => 'fr', 'LU' => 'fr', 'MC' => 'fr', 'ES' => 'es', 'MX' => 'es', 'AR' => 'es',
        'CO' => 'es', 'CL' => 'es', 'PE' => 'es', 'IT' => 'it', 'SM' => 'it', 'PT' => 'pt', 'BR' => 'pt-BR',
        'CZ' => 'cs', 'SK' => 'sk', 'RO' => 'ro', 'MD' => 'ro', 'HU' => 'hu', 'BG' => 'bg', 'LT' => 'lt',
        'LV' => 'lv', 'EE' => 'et', 'NL' => 'nl', 'SE' => 'sv', 'NO' => 'nb', 'DK' => 'da', 'FI' => 'fi',
        'GR' => 'el', 'CY' => 'el', 'TR' => 'tr', 'GE' => 'ka', 'AZ' => 'az', 'KZ' => 'kk', 'JP' => 'ja',
        'KR' => 'ko', 'CN' => 'zh', 'TW' => 'zh-TW', 'HR' => 'hr', 'RS' => 'sr', 'SI' => 'sl', 'IL' => 'he',
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * Усі додані мови з налаштувань.
     *
     * @return list<array{code: string, enabled: bool}>
     */
    public function configured(): array
    {
        $stored = $this->settings->get('languages');
        $out = [];
        foreach (is_array($stored) ? $stored : [] as $row) {
            $code = is_array($row) ? self::normalize((string) ($row['code'] ?? '')) : null;
            if ($code !== null && $code !== self::SOURCE) {
                $out[$code] = ['code' => $code, 'enabled' => (bool) ($row['enabled'] ?? true)];
            }
        }

        return array_values($out);
    }

    /**
     * Увімкнені мови, українська — першою.
     *
     * @return list<string>
     */
    public function enabled(): array
    {
        $codes = [self::SOURCE];
        foreach ($this->configured() as $row) {
            if ($row['enabled']) {
                $codes[] = $row['code'];
            }
        }

        return $codes;
    }

    public function isEnabled(?string $code): bool
    {
        return $code !== null && in_array($code, $this->enabled(), true);
    }

    /** Мова для тих, чия мова вимкнена або не підтримується. */
    public function fallback(): string
    {
        $code = self::normalize((string) $this->settings->get('default_locale'));

        return $this->isEnabled($code) ? (string) $code : self::SOURCE;
    }

    /**
     * Перемикач мов: код, назва рідною мовою.
     *
     * @return list<array{code: string, native: string}>
     */
    public function options(): array
    {
        return array_map(fn (string $code) => ['code' => $code, 'native' => self::nativeName($code)], $this->enabled());
    }

    /** Мова людини поза запитом (push, листи): вибрана в профілі або типова. */
    public function forUser(User $user): string
    {
        return $this->isEnabled($user->locale) ? (string) $user->locale : $this->fallback();
    }

    public function resolve(Request $request): string
    {
        $user = $request->user();
        if ($user instanceof User && $this->isEnabled($user->locale)) {
            return (string) $user->locale;
        }
        foreach ([$request->cookie(self::COOKIE), $request->header('X-Locale')] as $candidate) {
            $code = is_string($candidate) ? self::normalize($candidate) : null;
            if ($this->isEnabled($code)) {
                return (string) $code;
            }
        }

        // Браузер англійською (типово на багатьох телефонах) або мовою, якої немає на сайті, —
        // беремо мову країни за IP: в Україні — українська, хоч телефон і англійською.
        $browser = $this->match((string) $request->header('Accept-Language'));
        if ($browser === null || self::primary($browser) === 'en') {
            $byCountry = $this->forCountry(app(VisitorCountry::class)->of($request));
            if ($byCountry !== null) {
                return $byCountry;
            }
        }

        return $browser ?? $this->fallback();
    }

    /** Мова країни (ISO 3166 → увімкнена мова сайту) або null. */
    public function forCountry(?string $country): ?string
    {
        $code = self::COUNTRY_LANGUAGES[strtoupper((string) $country)] ?? null;
        if ($code === null) {
            return null;
        }
        if ($this->isEnabled($code)) {
            return $code;
        }
        foreach ($this->enabled() as $candidate) {
            if (self::primary($candidate) === self::primary($code)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Найкраща увімкнена мова за Accept-Language: точний збіг, потім за мовою без регіону.
     */
    public function match(string $header): ?string
    {
        $enabled = $this->enabled();
        $wanted = [];
        foreach (explode(',', $header) as $i => $part) {
            [$tag, $q] = array_pad(explode(';q=', trim($part)), 2, '1');
            $code = self::normalize(trim(explode(';', $tag)[0]));
            if ($code !== null && (float) $q > 0) {
                $wanted[] = [$code, (float) $q, $i];
            }
        }
        usort($wanted, fn ($a, $b) => [$b[1], $a[2]] <=> [$a[1], $b[2]]);
        foreach ($wanted as [$code]) {
            if (in_array($code, $enabled, true)) {
                return $code;
            }
            $primary = self::primary($code);
            foreach ($enabled as $candidate) {
                if (self::primary($candidate) === $primary) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    /**
     * «uk-UA», «en_us», «ua», «pt-br» → «uk-UA», «en-US», «uk», «pt-BR». Неправильний код — null.
     */
    public static function normalize(string $code): ?string
    {
        $code = str_replace('_', '-', trim($code));
        if (preg_match('/^([a-zA-Z]{2,3})(?:-([a-zA-Z]{4}))?(?:-([a-zA-Z]{2}|\d{3}))?$/', $code, $m) !== 1) {
            return null;
        }
        $lang = strtolower($m[1]);
        // Часта помилка: «ua» — це код країни, мова — «uk».
        $lang = $lang === 'ua' ? 'uk' : $lang;
        $out = $lang;
        if (($m[2] ?? '') !== '') {
            $out .= '-'.ucfirst(strtolower($m[2]));
        }
        if (($m[3] ?? '') !== '') {
            $out .= '-'.strtoupper($m[3]);
        }

        // Українська — одна, без регіону.
        return $lang === self::SOURCE ? self::SOURCE : $out;
    }

    public static function primary(string $code): string
    {
        return strtolower(explode('-', $code)[0]);
    }

    /** Чи відома мова ICU (щоб у налаштуваннях не додали «xx»). */
    public static function exists(string $code): bool
    {
        // ext-intl повертає string|false, а symfony/polyfill-intl-icu типізує як string — нормалізуємо.
        $name = Locale::getDisplayLanguage($code, 'en') ?: '';

        return $name !== '' && strtolower($name) !== strtolower(self::primary($code));
    }

    /** «English», «Deutsch», «português (Brasil)» — назва мови нею самою. */
    public static function nativeName(string $code): string
    {
        $name = Locale::getDisplayName($code, $code) ?: '';

        return $name === '' || $name === $code ? $code : mb_convert_case(mb_substr($name, 0, 1), MB_CASE_UPPER).mb_substr($name, 1);
    }

    /** Назва українською — для адмінки. */
    public static function ukrainianName(string $code): string
    {
        $name = Locale::getDisplayName($code, 'uk') ?: '';

        return $name !== '' ? $name : $code;
    }
}
