<?php

namespace App\Services\Design;

use App\Models\SiteTheme;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Стилі сайту з Адмінка → Дизайн.
 *
 * Стиль — звичайний CSS, що підключається після стандартного app.css і перевизначає змінні теми
 * (--background, --primary, --color-gc-* …) чи окремі класи. Активний стиль бачать усі; адміністратор
 * може подивитися будь-який стиль у себе через ?design_preview=<id> (до перезавантаження сторінки).
 *
 * Файл перевіряється: лише UTF-8, без HTML, @import, екранованих символів і зовнішніх адрес
 * (url() — тільки data: чи шляхи цього сайту), щоб стиль не міг тягнути чужі ресурси чи стежити за людьми.
 */
class SiteThemes
{
    public const CACHE_KEY = 'design.active_theme';

    public const MAX_BYTES = 200 * 1024;

    public const TEMPLATE = 'resources/design/theme-template.css';

    /** Адреса стилю для цього запиту: попередній перегляд адміністратора або активний стиль; null — стандартний вигляд. */
    public function urlFor(Request $request): ?string
    {
        $preview = $request->query('design_preview');
        if (is_string($preview) && $preview !== '' && $request->user()?->isAdmin()) {
            if ($preview === 'default') {
                return null;
            }
            $theme = ctype_digit($preview) ? SiteTheme::query()->find((int) $preview) : null;
            if ($theme !== null) {
                return $theme->url();
            }
        }

        return $this->activeUrl();
    }

    public function activeUrl(): ?string
    {
        $url = Cache::rememberForever(self::CACHE_KEY, fn () => SiteTheme::query()->where('is_active', true)->first()?->url() ?? '');

        return $url !== '' ? $url : null;
    }

    /**
     * Новий стиль або нова версія наявного (тоді його файл замінюється).
     *
     * @param  array{name: string, description?: string|null, author?: string|null}  $meta
     */
    public function save(string $css, array $meta, User $by, ?SiteTheme $theme = null): SiteTheme
    {
        if (($problem = $this->problem($css)) !== null) {
            throw ValidationException::withMessages(['file' => $problem]);
        }
        $hash = hash('sha256', $css);
        $slug = $theme->slug ?? $this->slug($meta['name']);
        $path = 'themes/'.$slug.'-'.substr($hash, 0, 12).'.css';
        Storage::disk('public')->put($path, $css);

        $old = $theme?->path;
        $theme ??= new SiteTheme(['slug' => $slug, 'version' => 0]);
        $theme->fill([
            'name' => $meta['name'],
            'description' => $meta['description'] ?? null,
            'author' => $meta['author'] ?? null,
            'path' => $path,
            'hash' => $hash,
            'size' => strlen($css),
            'version' => $theme->version + 1,
            'uploaded_by' => $by->id,
        ])->save();

        if ($old !== null && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        return $theme;
    }

    /** Увімкнути стиль для всього сайту (інші вимикаються); null — повернути стандартний вигляд. */
    public function activate(?SiteTheme $theme): void
    {
        DB::transaction(function () use ($theme) {
            SiteTheme::query()->where('is_active', true)->when($theme, fn ($q) => $q->whereKeyNot($theme->id))->update(['is_active' => false]);
            $theme?->update(['is_active' => true]);
        });
        Cache::forget(self::CACHE_KEY);
    }

    public function delete(SiteTheme $theme): void
    {
        $theme->delete();
        Storage::disk('public')->delete($theme->path);
        Cache::forget(self::CACHE_KEY);
    }

    /** Що не так із файлом стилю (текст для адміністратора) або null, якщо все гаразд. */
    public function problem(string $css): ?string
    {
        if (strlen($css) > self::MAX_BYTES) {
            return 'Файл стилю завеликий: до '.intdiv(self::MAX_BYTES, 1024).' КБ.';
        }
        if (trim($css) === '') {
            return 'Файл стилю порожній.';
        }
        if (! mb_check_encoding($css, 'UTF-8')) {
            return 'Файл стилю має бути в кодуванні UTF-8.';
        }
        if (str_contains($css, '<')) {
            return 'У стилі не може бути символу «<»: HTML і теги заборонені.';
        }
        if (str_contains($css, '\\')) {
            return 'Екрановані символи (\\) у стилі не підтримуються — пишіть символи як є.';
        }
        $lower = strtolower($css);
        foreach (['@import', 'expression(', 'javascript:', 'behavior:', '-moz-binding', 'image-set('] as $bad) {
            if (str_contains($lower, $bad)) {
                return 'У стилі заборонено «'.$bad.'».';
            }
        }
        preg_match_all('/url\(\s*([\'"]?)(.*?)\1\s*\)/is', $css, $matches);
        foreach ($matches[2] as $target) {
            if (! $this->allowedUrl(trim($target))) {
                return 'Зовнішні адреси в url() заборонені: «'.Str::limit($target, 60).'». Дозволено data: і шляхи цього сайту (/storage/…).';
            }
        }

        return null;
    }

    private function allowedUrl(string $target): bool
    {
        $lower = strtolower($target);
        if (str_starts_with($lower, 'data:')) {
            return (bool) preg_match('#^data:(image/(png|jpeg|gif|webp|avif|svg\+xml)|font/(woff2?|ttf|otf))[;,]#', $lower);
        }

        return str_starts_with($target, '/') && ! str_starts_with($target, '//');
    }

    private function slug(string $name): string
    {
        $base = Str::limit(Str::slug(Str::transliterate($name)) ?: 'style', 40, '');
        $slug = $base;
        for ($i = 2; SiteTheme::query()->where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return $slug;
    }
}
