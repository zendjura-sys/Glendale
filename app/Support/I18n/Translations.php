<?php

namespace App\Support\I18n;

use App\Models\Translation;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cache;

/**
 * Словники мов і переклад того, що віддає сервер.
 *
 * Серверний код лишається українським: перед відповіддю (JSON, сторінка Inertia, push)
 * рядки, що точно збігаються з текстом каталогу, замінюються перекладом. Рядки з підстановками
 * («Вас заглушено до 12.10 18:00») — за шаблонами каталогу «Вас заглушено до {0}».
 * Каталог (lang/catalog.json) збирає scripts/i18n/extract.mjs з коду сайту, сервера й застосунку.
 */
class Translations
{
    /** Поля з текстом користувачів — їх не чіпаємо. */
    private const USER_CONTENT = ['body', 'content', 'bio', 'caption', 'lyrics', 'excerpt', 'preview', 'last_message', 'native', 'translation'];

    /** @var array<string, array<string, string>> */
    private array $dicts = [];

    /** @var array<string, array{prefixed: array<string, list<array{0: string, 1: string}>>, floating: list<array{0: string, 1: string, 2: string}>}> */
    private array $patterns = [];

    /** @var array{web?: list<string>, server?: list<string>, app?: list<string>}|null */
    private ?array $catalog = null;

    /**
     * Ключі каталогу за областю: web — сайт, server — відповіді сервера, app — застосунок.
     *
     * @return list<string>
     */
    public function catalog(?string $scope = null): array
    {
        if ($this->catalog === null) {
            $path = lang_path('catalog.json');
            $data = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
            $this->catalog = [];
            foreach (['web', 'server', 'app'] as $key) {
                $list = is_array($data) && is_array($data[$key] ?? null) ? $data[$key] : [];
                $this->catalog[$key] = array_values(array_filter($list, 'is_string'));
            }
        }
        if ($scope !== null) {
            return $this->catalog[$scope] ?? [];
        }

        return array_values(array_unique(array_merge($this->catalog['web'] ?? [], $this->catalog['server'] ?? [], $this->catalog['app'] ?? [])));
    }

    /** Версія словника мови — змінюється після кожного оновлення перекладів. */
    public function version(string $locale): string
    {
        return (string) Cache::rememberForever("i18n.version.{$locale}", fn () => (string) time());
    }

    public function touch(string $locale): void
    {
        Cache::forever("i18n.version.{$locale}", (string) (time() + random_int(1, 999)));
        unset($this->dicts[$locale], $this->patterns[$locale]);
    }

    /**
     * Повний словник мови: джерело → переклад.
     *
     * @return array<string, string>
     */
    public function dictionary(string $locale): array
    {
        if ($locale === Locales::SOURCE) {
            return [];
        }
        if (! isset($this->dicts[$locale])) {
            $this->dicts[$locale] = Cache::rememberForever("i18n.dict.{$locale}.".$this->version($locale), function () use ($locale) {
                $out = [];
                foreach (Translation::query()->where('locale', $locale)->get(['source', 'value']) as $row) {
                    if ($row->value !== '') {
                        $out[$row->source] = $row->value;
                    }
                }

                return $out;
            });
        }

        return $this->dicts[$locale];
    }

    /**
     * Словник для сайту чи застосунку — лише його ключі.
     *
     * @return array<string, string>
     */
    public function scoped(string $locale, string $scope): array
    {
        $dict = $this->dictionary($locale);

        return $dict === [] ? [] : array_intersect_key($dict, array_flip($this->catalog($scope)));
    }

    /** Переклад одного рядка (точний збіг або шаблон). */
    public function line(string $text, ?string $locale = null): string
    {
        $locale ??= App::getLocale();
        if ($locale === Locales::SOURCE || $text === '' || preg_match('/[А-Яа-яІіЇїЄєҐґ]/u', $text) !== 1) {
            return $text;
        }
        $dict = $this->dictionary($locale);
        if ($dict === []) {
            return $text;
        }
        if (isset($dict[$text])) {
            return $dict[$text];
        }
        // Пробіли й розділові знаки по краях («Видалити?» → «Delete?») — частий випадок.
        $trimmed = trim($text);
        if ($trimmed !== $text && isset($dict[$trimmed])) {
            return str_replace($trimmed, $dict[$trimmed], $text);
        }

        return $this->byPattern($text, $locale) ?? $text;
    }

    /**
     * Переклад усіх рядків у даних відповіді (крім текстів користувачів).
     */
    public function tree(mixed $data, ?string $locale = null): mixed
    {
        $locale ??= App::getLocale();
        if ($locale === Locales::SOURCE || $this->dictionary($locale) === []) {
            return $data;
        }

        return $this->walk($data, $locale);
    }

    private function walk(mixed $data, string $locale): mixed
    {
        if (is_string($data)) {
            return $this->line($data, $locale);
        }
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                if (is_string($key) && in_array($key, self::USER_CONTENT, true)) {
                    continue;
                }
                $data[$key] = $this->walk($value, $locale);
            }

            return $data;
        }
        if ($data instanceof \stdClass) {
            foreach (get_object_vars($data) as $key => $value) {
                if (! in_array($key, self::USER_CONTENT, true)) {
                    $data->{$key} = $this->walk($value, $locale);
                }
            }
        }

        return $data;
    }

    private function byPattern(string $text, string $locale): ?string
    {
        $index = $this->patternIndex($locale);
        $candidates = $index['prefixed'][mb_substr($text, 0, 3)] ?? [];
        foreach ($candidates as [$regex, $target]) {
            if (preg_match($regex, $text, $m) === 1) {
                return $this->fill($target, $m);
            }
        }
        foreach ($index['floating'] as [$needle, $regex, $target]) {
            if (str_contains($text, $needle) && preg_match($regex, $text, $m) === 1) {
                return $this->fill($target, $m);
            }
        }

        return null;
    }

    /**
     * @param  array<int|string, string>  $m
     */
    private function fill(string $target, array $m): string
    {
        return (string) preg_replace_callback('/\{(\d+)\}/', fn (array $p) => $m[(int) $p[1] + 1] ?? $p[0], $target);
    }

    /**
     * Шаблони «текст {0} текст» → регулярні вирази, згруповані за першими літерами.
     *
     * @return array{prefixed: array<string, list<array{0: string, 1: string}>>, floating: list<array{0: string, 1: string, 2: string}>}
     */
    private function patternIndex(string $locale): array
    {
        if (isset($this->patterns[$locale])) {
            return $this->patterns[$locale];
        }
        $index = ['prefixed' => [], 'floating' => []];
        foreach ($this->dictionary($locale) as $source => $target) {
            if (! str_contains($source, '{0}')) {
                continue;
            }
            $parts = preg_split('/\{\d+\}/', $source) ?: [];
            $regex = '/^'.implode('(.+?)', array_map(fn (string $p) => preg_quote($p, '/'), $parts)).'$/su';
            // Підстановки нумеруються за порядком у джерелі: {0}, {1}… — переставляємо під порядок у шаблоні.
            preg_match_all('/\{(\d+)\}/', $source, $order);
            $map = array_flip(array_map('intval', $order[1]));
            $target = (string) preg_replace_callback('/\{(\d+)\}/', fn (array $p) => '{'.($map[(int) $p[1]] ?? $p[1]).'}', $target);
            $head = $parts[0] ?? '';
            if (mb_strlen($head) >= 3) {
                $index['prefixed'][mb_substr($head, 0, 3)][] = [$regex, $target];
            } else {
                $needle = '';
                foreach ($parts as $part) {
                    if (mb_strlen(trim($part)) > mb_strlen($needle)) {
                        $needle = trim($part);
                    }
                }
                if ($needle !== '') {
                    $index['floating'][] = [$needle, $regex, $target];
                }
            }
        }

        return $this->patterns[$locale] = $index;
    }
}
