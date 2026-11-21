<?php

namespace App\Support;

use App\Models\User;
use App\Models\VideoBackground;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Фон сайту (Налаштування → Вигляд): жива сцена за інтерфейсом, вимикач руху й — для GameCon+ —
 * відеофон з бібліотеки, яку наповнює адміністрація (окремі файли для смартфона й ПК/планшета).
 * У налаштуваннях людини зберігаємо лише ID відеофону. Фірмовий фон (`custom`) —
 * картинки, завантажені в Адмінка → Дизайн: окремо для комп'ютера й для телефона.
 */
class Backgrounds
{
    public const DEFAULT = 'aurora';

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
     * Активні відеофони бібліотеки (кеш — масиви, не моделі).
     *
     * @return list<array{id: int, title: string, mobile: string|null, desktop: string|null, poster: string|null}>
     */
    public static function videos(): array
    {
        return Cache::remember('backgrounds.videos', 600, fn () => VideoBackground::query()->where('is_active', true)
            ->orderBy('position')->orderBy('id')->get()->map->card()->values()->all());
    }

    public static function forgetVideos(): void
    {
        Cache::forget('backgrounds.videos');
    }

    /**
     * Відеофон бібліотеки за ID з налаштувань (старі ID YouTube — рядки — більше не діють).
     *
     * @return array{id: int, title: string, mobile: string|null, desktop: string|null, poster: string|null}|null
     */
    public static function video(mixed $id): ?array
    {
        if (! is_numeric($id)) {
            return null;
        }
        foreach (self::videos() as $video) {
            if ($video['id'] === (int) $id) {
                return $video;
            }
        }

        return null;
    }

    /**
     * @return array{preset: string, motion: bool, video: array{id: int, title: string, mobile: string|null, desktop: string|null, poster: string|null}|null}
     */
    public static function for(User $user): array
    {
        $default = self::defaultPreset();
        $preset = (string) $user->pref('background', $default);

        return [
            'preset' => in_array($preset, self::presets(), true) ? $preset : $default,
            'motion' => (bool) $user->pref('background_motion', true),
            // Відеофон — привілей GameCon+: після закінчення підписки просто не показується (налаштування лишається).
            'video' => $user->isPlus() ? self::video($user->pref('background_video')) : null,
        ];
    }
}
