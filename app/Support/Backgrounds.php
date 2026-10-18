<?php

namespace App\Support;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Storage;

/**
 * Фон сайту (Налаштування → Вигляд): жива сцена за інтерфейсом, вимикач руху й — для GameCon+ —
 * власне відео з YouTube. Зберігаємо лише ID відео, не посилання. Фірмовий фон (`custom`) —
 * картинки, завантажені в Адмінка → Дизайн: окремо для комп'ютера й для телефона.
 */
class Backgrounds
{
    public const DEFAULT = 'dune';

    /** Сцени в порядку показу в налаштуваннях; `none` — однотонне тло без сцени. */
    public const PRESETS = ['dune', 'aurora', 'night', 'ocean', 'mesh', 'none'];

    /** Фірмовий фон з адмінки; доступний, лише коли завантажено хоч одну картинку. */
    public const CUSTOM = 'custom';

    /** Налаштування сайту: {desktop: шлях|null, mobile: шлях|null, default: bool}. */
    public const SETTING = 'background_image';

    /**
     * Фірмовий фон: адреси картинок і чи це типовий фон сайту; null — не завантажено.
     *
     * @return array{desktop: string|null, mobile: string|null, default: bool}|null
     */
    public static function image(): ?array
    {
        $stored = self::stored();
        if ($stored['desktop'] === null && $stored['mobile'] === null) {
            return null;
        }
        $url = fn (?string $path) => $path === null ? null : Storage::disk('public')->url($path);

        return ['desktop' => $url($stored['desktop']), 'mobile' => $url($stored['mobile']), 'default' => $stored['default']];
    }

    /**
     * @return array{desktop: string|null, mobile: string|null, default: bool}
     */
    public static function stored(): array
    {
        $value = app(SiteSettings::class)->get(self::SETTING);
        $value = is_array($value) ? $value : [];
        $path = fn (string $key) => is_string($value[$key] ?? null) && $value[$key] !== '' ? $value[$key] : null;

        return ['desktop' => $path('desktop'), 'mobile' => $path('mobile'), 'default' => (bool) ($value['default'] ?? false)];
    }

    /**
     * Сцени, які можна обрати зараз (фірмовий — першим, якщо завантажений).
     *
     * @return list<string>
     */
    public static function presets(): array
    {
        return self::image() === null ? self::PRESETS : [self::CUSTOM, ...self::PRESETS];
    }

    /** Фон для гостей і тих, хто не обирав свій. */
    public static function defaultPreset(): string
    {
        return (self::image()['default'] ?? false) ? self::CUSTOM : self::DEFAULT;
    }

    /**
     * ID відео з посилання YouTube (watch, youtu.be, shorts, embed, live) або null.
     */
    public static function youtubeId(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }
        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $url) === 1) {
            return $url;
        }
        $parts = parse_url(str_contains($url, '://') ? $url : 'https://'.$url);
        $host = strtolower(preg_replace('/^(www\.|m\.|music\.)/', '', $parts['host'] ?? ''));
        $path = $parts['path'] ?? '';
        $id = null;
        if ($host === 'youtu.be') {
            $id = explode('/', trim($path, '/'))[0];
        } elseif (in_array($host, ['youtube.com', 'youtube-nocookie.com'], true)) {
            parse_str($parts['query'] ?? '', $query);
            $id = is_string($query['v'] ?? null)
                ? $query['v']
                : (preg_match('#^/(?:shorts|embed|live|v)/([^/?]+)#', $path, $m) === 1 ? $m[1] : null);
        }

        return is_string($id) && preg_match('/^[A-Za-z0-9_-]{11}$/', $id) === 1 ? $id : null;
    }

    /**
     * @return array{preset: string, motion: bool, video: string|null}
     */
    public static function for(User $user): array
    {
        $default = self::defaultPreset();
        $preset = (string) $user->pref('background', $default);

        return [
            'preset' => in_array($preset, self::presets(), true) ? $preset : $default,
            'motion' => (bool) $user->pref('background_motion', true),
            // Відео — привілей GameCon+: після закінчення підписки просто не показується (налаштування лишається).
            'video' => $user->isPlus() ? self::youtubeId($user->pref('background_video')) : null,
        ];
    }
}
