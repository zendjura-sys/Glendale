<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Storage;

/**
 * Настройки оформления: бренд (лого, фавикон, название) и параметры
 * самой темы.
 *
 * Раньше «Дизайн» был типом аддона — ZIP с css/js, который подменял
 * оформление целиком. Для сайта на Vue 3 со сборкой через Vite это не
 * работает: тема в архиве не может влезть в скомпилированные компоненты,
 * а класть её файлы рядом — значит держать два несогласованных
 * оформления. Поэтому оформление настраивается здесь, а не ставится
 * пакетом.
 */
class DesignSettings
{
    private const GROUP = 'design';

    public const DEFAULT_ACCENT = '#D4AF37';

    /** Насколько густая «атмосфера» (аврора, зерно, свечения). */
    public const EFFECT_LEVELS = ['full', 'soft', 'off'];

    /** Файлы бренда лежат в public-диске: их отдаёт веб-сервер напрямую. */
    public const BRAND_DIR = 'brand';

    /** Знімки для каруселі "Галерея родини" — окремо від brand/avatars. */
    public const GALLERY_DIR = 'gallery';

    /**
     * Сезонні прикраси поверх сайту — легкий canvas-шар (сніжинки,
     * конфеті, пелюстки), той самий підхід, що вже й так вимикається на
     * /admin і при effects=off (див. syncDecorations() в app.js).
     * Вручну перемикається адміном — без автоматики за датою, щоб не
     * плутатись у часових поясах і не забувати вимкнути після свята.
     */
    public const SEASONAL_THEMES = ['none', 'new_year', 'christmas', 'easter', 'birthday'];

    /** @return array<string,mixed> */
    public static function all(): array
    {
        return [
            'siteName' => Setting::get('site_name') ?: config('app.name'),
            'siteTagline' => Setting::get('site_tagline') ?: null,
            'accent' => self::accent(),
            'effects' => self::effects(),
            'logoUrl' => self::assetUrl('design_logo'),
            'faviconUrl' => self::assetUrl('design_favicon'),
            'seasonalTheme' => self::seasonalTheme(),
        ];
    }

    /** Заголовок і слоган union.gamecon.online — той самий Setting-патерн, що й siteName/siteTagline вище. */
    public static function unionTitle(): string
    {
        return Setting::get('union_title') ?: 'Спільнота союзників Monsory';
    }

    public static function unionTagline(): ?string
    {
        return Setting::get('union_tagline') ?: null;
    }

    public static function saveUnion(string $title, ?string $tagline): void
    {
        Setting::set('union_title', trim($title) ?: null, self::GROUP);
        Setting::set('union_tagline', trim((string) $tagline) ?: null, self::GROUP);
    }

    public static function seasonalTheme(): string
    {
        $value = trim((string) Setting::get('design_seasonal_theme'));

        return in_array($value, self::SEASONAL_THEMES, true) ? $value : 'none';
    }

    public static function saveSeasonalTheme(string $theme): void
    {
        Setting::set('design_seasonal_theme', in_array($theme, self::SEASONAL_THEMES, true) ? $theme : 'none', self::GROUP);
    }

    /**
     * Каруселі на головній — учасники родини (аватарки) і галерея
     * (знімки подій, вантажені адміном). За замовчуванням обидві
     * увімкнені: порожній набір фото просто не рендериться на сторінці,
     * тож увімкнене за дефолтом нічого не показує, поки не з'явиться
     * реальний контент.
     */
    public static function showMemberCarousel(): bool
    {
        $value = Setting::get('design_show_member_carousel');

        return $value === null || $value === '1';
    }

    public static function showGalleryCarousel(): bool
    {
        $value = Setting::get('design_show_gallery_carousel');

        return $value === null || $value === '1';
    }

    /** Платформи соцмереж, які можна додати у футер головної. */
    public const SOCIAL_PLATFORMS = ['telegram', 'discord', 'tiktok', 'youtube', 'instagram', 'twitter', 'vk', 'website'];

    /**
     * Посилання на соцмережі у футері головної — вільний список, який
     * веде адмін (Дизайн → Соцмережі). Зберігається одним JSON-полем:
     * порядок рядків важливий (як їх показувати), а окрема таблиця для
     * рідко змінюваного списку з кількох елементів — надмірність.
     *
     * @return array<int,array{platform:string,url:string}>
     */
    public static function socialLinks(): array
    {
        $raw = json_decode((string) Setting::get('design_social_links'), true);
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_filter(array_map(static function ($row) {
            if (! is_array($row)) {
                return null;
            }
            $platform = (string) ($row['platform'] ?? '');
            $url = trim((string) ($row['url'] ?? ''));

            return in_array($platform, self::SOCIAL_PLATFORMS, true) && $url !== ''
                ? ['platform' => $platform, 'url' => $url]
                : null;
        }, $raw)));
    }

    /** @param array<int,array{platform:string,url:string}> $links */
    public static function saveSocialLinks(array $links): void
    {
        Setting::set('design_social_links', json_encode($links), self::GROUP);
    }

    public static function accent(): string
    {
        $value = trim((string) Setting::get('design_accent'));

        // Только настоящий hex: значение уходит прямо в CSS-переменную,
        // и мусор оттуда ломает всю палитру страницы.
        return preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? strtoupper($value) : self::DEFAULT_ACCENT;
    }

    public static function effects(): string
    {
        $value = trim((string) Setting::get('design_effects'));

        return in_array($value, self::EFFECT_LEVELS, true) ? $value : 'full';
    }

    /**
     * Оттенки акцента как CSS-переменные для <head>.
     *
     * Палитра золота живёт в Tailwind как rgb(var(--gold-N)), поэтому
     * достаточно переопределить пять переменных — перекрашивается весь
     * сайт разом, без пересборки бандла. Пока цвет не меняли, отдаём
     * пустую строку: дефолты уже лежат в :root, и лишний inline-стиль в
     * каждой странице ни к чему.
     */
    public static function accentCss(): string
    {
        $accent = self::accent();

        if ($accent === self::DEFAULT_ACCENT) {
            return '';
        }

        [$r, $g, $b] = sscanf($accent, '#%02x%02x%02x');

        // Доли подобраны по исходной золотой палитре: именно в таких
        // отношениях #d4af37 даёт #f8efd8 … #a9822f. От одного цвета без
        // ступеней получилась бы плоская заливка вместо градиентов.
        $shades = [
            100 => self::mix($r, $g, $b, 0.81),
            200 => self::mix($r, $g, $b, 0.65),
            300 => self::mix($r, $g, $b, 0.39),
            350 => self::mix($r, $g, $b, 0.25),
            400 => [$r, $g, $b],
            500 => self::mix($r, $g, $b, -0.06),
            600 => self::mix($r, $g, $b, -0.20),
        ];

        $css = '';
        foreach ($shades as $key => [$sr, $sg, $sb]) {
            $css .= "--gold-{$key}:{$sr} {$sg} {$sb};";
        }

        return $css;
    }

    /**
     * Ті самі відтінки акценту, що й accentCss(), але як HEX-рядки і
     * завжди повним набором (навіть коли колір ще дефолтний) — мобільний
     * застосунок будує свою кольорову схему з цих значень через
     * /api/app-config, а не тримає власну копію формули змішування.
     *
     * @return array<int,string>
     */
    public static function accentShades(): array
    {
        $accent = self::accent();
        [$r, $g, $b] = sscanf($accent, '#%02x%02x%02x');

        $amounts = [100 => 0.81, 200 => 0.65, 300 => 0.39, 350 => 0.25, 400 => 0.0, 500 => -0.06, 600 => -0.20];

        $shades = [];
        foreach ($amounts as $key => $amount) {
            [$sr, $sg, $sb] = $amount === 0.0 ? [$r, $g, $b] : self::mix($r, $g, $b, $amount);
            $shades[$key] = sprintf('#%02X%02X%02X', $sr, $sg, $sb);
        }

        return $shades;
    }

    /**
     * Смешивает цвет с белым (amount > 0) или чёрным (amount < 0).
     *
     * @return array{0:int,1:int,2:int}
     */
    private static function mix(int $r, int $g, int $b, float $amount): array
    {
        $target = $amount > 0 ? 255 : 0;
        $weight = abs($amount);

        return [
            (int) round($r + ($target - $r) * $weight),
            (int) round($g + ($target - $g) * $weight),
            (int) round($b + ($target - $b) * $weight),
        ];
    }

    /** Публичный URL загруженного файла бренда, если он есть. */
    public static function assetUrl(string $key): ?string
    {
        $path = trim((string) Setting::get($key));

        if ($path === '' || ! Storage::disk('public')->exists($path)) {
            return null;
        }

        // Версия в query — иначе браузер держит старый логотип из кэша
        // до посинения, и загрузка нового выглядит как «не сработало».
        return Storage::disk('public')->url($path).'?v='.Storage::disk('public')->lastModified($path);
    }

    /** Удаляет прошлый файл: иначе storage копит все загруженные логотипы. */
    public static function replaceAsset(string $key, ?string $newPath): void
    {
        $old = trim((string) Setting::get($key));

        if ($old !== '' && $old !== $newPath && Storage::disk('public')->exists($old)) {
            Storage::disk('public')->delete($old);
        }

        Setting::set($key, $newPath, self::GROUP);
    }
}
