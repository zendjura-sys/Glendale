<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Str;

/**
 * Содержание родины: должности, направления, критерии роста и структура
 * руководства.
 *
 * Два источника: config/family.php как значения по умолчанию и настройки
 * в БД как правки из админки. Раньше всё это лежало прямо в Home.vue,
 * поэтому смена состава руководства или формулировки должности означала
 * правку кода и деплой — а состав меняется куда чаще, чем выходит релиз.
 *
 * Читают отсюда И сайт, И бот в Telegram: разъехаться им больше негде.
 */
class FamilyContent
{
    private const GROUP = 'content';

    /**
     * Типовий склад для нової родини (config/family.php — це вміст саме
     * Monsory, першої родини). Лідер змінює все під себе в керуванні родиною.
     */
    private const GENERIC = [
        'positions' => [
            ['key' => 'newcomer', 'title' => 'Новачок', 'text' => '', 'image' => ''],
            ['key' => 'member', 'title' => 'Учасник', 'text' => '', 'image' => ''],
            ['key' => 'veteran', 'title' => 'Ветеран', 'text' => '', 'image' => ''],
            ['key' => 'officer', 'title' => 'Старший', 'text' => '', 'image' => ''],
            ['key' => 'deputy', 'title' => 'Заступник', 'text' => '', 'image' => ''],
            ['key' => 'leader', 'title' => 'Лідер', 'text' => '', 'image' => ''],
        ],
        'directions' => [],
        'leadership' => [],
        'promotion_criteria' => [],
        'about' => [],
    ];

    /**
     * Контент — свій у кожній родини: у першій (Monsory) — колишні ключі
     * (нічого не переноситься), в інших — «family.{id}.{ключ}». Тексти
     * союзу (union_*) — спільні.
     */
    private static function keyFor(string $key): string
    {
        $familyId = self::familyId($key);

        return $familyId === null ? $key : "family.{$familyId}.{$key}";
    }

    /** Родина, чий контент читається; null — перша родина (Monsory) або союз. */
    private static function familyId(?string $key = null): ?int
    {
        if ($key !== null && str_starts_with($key, 'union_')) {
            return null;
        }
        $id = \App\Families\FamilyContext::id();

        return ($id === null || $id === \App\Families\FamilyContext::defaultId()) ? null : $id;
    }

    /** @return array<int,mixed> Значення за замовчуванням: Monsory — config, інші — типовий склад. */
    private static function defaults(string $key): array
    {
        return self::familyId($key) === null ? (array) config("family.{$key}", []) : (self::GENERIC[$key] ?? []);
    }

    /** Ключи, которые админка может перезаписать, и их форма. */
    private const SHAPES = [
        // 'key' первым нарочно: это единственное поле здесь, которое
        // форма редактирования НЕ показывает и не даёт трогать — оно
        // просто едет транзитом при каждом сохранении (см. save()).
        'positions' => ['key', 'title', 'text', 'image'],
        'directions' => ['title', 'tag', 'text', 'image'],
        'leadership' => ['title', 'text', 'nickname'],
    ];

    /** @return array<int,array<string,string>> */
    public static function positions(): array
    {
        return self::list('positions');
    }

    /**
     * Одна должность по стабильному ключу — им хранится назначение
     * участника (users.position_key), а НЕ индексом в списке и не
     * заголовком.
     *
     * Индекс сюда не годится: в Дизайн → Розділи должности можно
     * переставлять стрелками ↑/↓ и удалять — при хранении индексом это
     * молча переприсваивало бы реальным людям чужие должности при первой
     * же перестановке, без единого предупреждения. Заголовок не годится
     * по той же причине при переименовании. Ключ переживает и то, и
     * другое: он вообще не завязан на порядок или текст.
     *
     * @return array<string,string>|null
     */
    public static function positionByKey(?string $key): ?array
    {
        if ($key === null || $key === '') {
            return null;
        }

        foreach (self::positions() as $position) {
            if (($position['key'] ?? null) === $key) {
                return $position;
            }
        }

        return null;
    }

    /** @return array<int,string> Ключи всех должностей в текущем порядке. */
    public static function positionKeys(): array
    {
        return array_column(self::positions(), 'key');
    }

    /** @return array<int,array<string,string>> */
    public static function directions(): array
    {
        return self::list('directions');
    }

    /** @return array<int,array<string,string>> */
    public static function leadership(): array
    {
        return self::list('leadership');
    }

    /** @return array<int,string> */
    public static function promotionCriteria(): array
    {
        $stored = self::decode('promotion_criteria');

        if ($stored === null) {
            return self::defaults('promotion_criteria');
        }

        return array_values(array_filter(
            array_map(static fn ($v) => trim((string) $v), $stored),
            static fn (string $v) => $v !== '',
        ));
    }

    /** @return array<int,string> */
    public static function about(): array
    {
        $stored = self::decode('about');

        if ($stored === null) {
            return self::defaults('about');
        }

        return array_values(array_filter(
            array_map(static fn ($v) => trim((string) $v), $stored),
            static fn (string $v) => $v !== '',
        ));
    }

    /** @return array<int,string> Текст для union.gamecon.online — див. коментар у config/family.php. */
    public static function unionAbout(): array
    {
        return self::simpleList('union_about');
    }

    /** @return array<int,string> */
    public static function unionRules(): array
    {
        return self::simpleList('union_rules');
    }

    /** @return array<int,string> */
    public static function unionTerms(): array
    {
        return self::simpleList('union_terms');
    }

    /** @return array<int,string> Список рядків: правка з адмінки або значення за замовчуванням з config/family.php. */
    private static function simpleList(string $key): array
    {
        $stored = self::decode($key);

        if ($stored === null) {
            return self::defaults($key);
        }

        return array_values(array_filter(
            array_map(static fn ($v) => trim((string) $v), $stored),
            static fn (string $v) => $v !== '',
        ));
    }

    public static function baseCount(): int
    {
        return (int) config('family.base_count', 5);
    }

    /**
     * Сохранение из админки. Каждая запись приводится к форме из SHAPES:
     * так в настройках не оседают лишние ключи, которые пришли из формы.
     *
     * @param  array<int,array<string,mixed>>|array<int,string>  $value
     */
    public static function save(string $key, array $value): void
    {
        if ($key === 'positions') {
            $value = self::preparePositions($value);
        } elseif (isset(self::SHAPES[$key])) {
            $fields = self::SHAPES[$key];
            $value = array_values(array_map(
                static fn (array $row) => array_map(
                    static fn (string $f) => trim((string) ($row[$f] ?? '')),
                    array_combine($fields, $fields),
                ),
                array_filter($value, static fn ($row) => is_array($row) && trim((string) ($row['title'] ?? '')) !== ''),
            ));
        } else {
            $value = array_values(array_filter(
                array_map(static fn ($v) => trim((string) $v), $value),
                static fn (string $v) => $v !== '',
            ));
        }

        Setting::set(self::keyFor($key), json_encode($value, JSON_UNESCAPED_UNICODE), self::GROUP);
    }

    /**
     * Должности — с сохранением стабильного ключа за каждой строкой.
     * Форма редактирования (Дизайн → Розділи) поле key не показывает и не
     * трогает: оно просто едет транзитом вместе с остальными полями
     * строки. Ключ генерируется заново только для строк, у которых его
     * ещё нет вовсе — то есть для новых должностей, добавленных кнопкой
     * «+ Додати посаду».
     *
     * @param  array<int,array<string,mixed>>  $rows
     * @return array<int,array<string,string>>
     */
    private static function preparePositions(array $rows): array
    {
        $used = [];
        $prepared = [];

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }

            $key = trim((string) ($row['key'] ?? ''));
            if ($key === '' || isset($used[$key])) {
                $key = self::uniqueSlug($title, $used);
            }
            $used[$key] = true;

            $prepared[] = [
                'key' => $key,
                'title' => $title,
                'text' => trim((string) ($row['text'] ?? '')),
                'image' => trim((string) ($row['image'] ?? '')),
            ];
        }

        return $prepared;
    }

    /** @param array<string,bool> $used */
    private static function uniqueSlug(string $title, array $used): string
    {
        $base = Str::slug($title) ?: 'position';
        $slug = $base;

        for ($i = 2; isset($used[$slug]); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    /** Вернуть ключ к значению из config/family.php. */
    public static function reset(string $key): void
    {
        Setting::set(self::keyFor($key), null, self::GROUP);
    }

    /** @return array<int,array<string,string>> */
    private static function list(string $key): array
    {
        $stored = self::decode($key);

        if ($stored === null) {
            return $key === 'positions' ? self::preparePositions(self::defaults($key)) : self::defaults($key);
        }

        // Посади читаються через той самий preparePositions(), що й при
        // збереженні: якщо в БД лежать рядки, збережені ДО того, як
        // з'явилось поле key (наприклад, адмін зберіг "Дизайн → Розділи"
        // ще на попередній версії сайту), ключ довелось би генерувати —
        // а без цього кроку тут кожен рядок мовчки отримав би key: '',
        // і призначення посад (users.position_key) перестали б
        // резолвитись. Генерація детермінована (Str::slug(title) +
        // порядок рядків), тому повторні виклики між збереженнями дають
        // той самий ключ.
        if ($key === 'positions') {
            return self::preparePositions($stored);
        }

        $fields = self::SHAPES[$key];

        return array_values(array_map(
            static fn (array $row) => array_map(
                static fn (string $f) => (string) ($row[$f] ?? ''),
                array_combine($fields, $fields),
            ),
            array_filter($stored, static fn ($row) => is_array($row)),
        ));
    }

    /**
     * null означает «в админке не трогали» — тогда берём значения из
     * конфига. Пустой массив это НЕ то же самое: им админ мог намеренно
     * очистить список.
     *
     * @return array<int,mixed>|null
     */
    private static function decode(string $key): ?array
    {
        $raw = Setting::get(self::keyFor($key));

        if ($raw === null || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }
}
