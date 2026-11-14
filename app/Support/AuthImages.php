<?php

namespace App\Support;

use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Storage;

/**
 * Фони сторінок входу й реєстрації (Адмінка → Дизайн): окремо для сайту (комп'ютер і планшет,
 * телефон) і для застосунку (телефон, планшет). Без картинки — фірмове тло GameCon.
 */
class AuthImages
{
    public const SETTING = 'auth_images';

    /** Слот → найбільша сторона після стиснення. */
    public const KINDS = ['site_desktop' => 3200, 'site_mobile' => 2400, 'app_phone' => 2400, 'app_tablet' => 2800];

    /** @return array<string, string|null> шляхи на диску public */
    public static function stored(): array
    {
        $value = app(SiteSettings::class)->get(self::SETTING);
        $value = is_array($value) ? $value : [];

        return collect(self::KINDS)->map(fn ($_, string $kind) => is_string($value[$kind] ?? null) && $value[$kind] !== '' ? $value[$kind] : null)->all();
    }

    /** @return array<string, string|null> адреси картинок */
    public static function urls(): array
    {
        return collect(self::stored())->map(fn (?string $path) => $path === null ? null : Storage::disk('public')->url($path))->all();
    }

    /** @param  array<string, string|null>  $stored */
    public static function save(array $stored): void
    {
        app(SiteSettings::class)->put([self::SETTING => $stored]);
    }
}
