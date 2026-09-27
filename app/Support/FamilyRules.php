<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Розділ «Правила» — один спільний текст для сайту (/rules) і мобільного
 * застосунку (/api/rules), той самий принцип, що й GuideContent.
 *
 * Тексти лежать у resources/rules/*.md у ТОМУ Ж форматі, у якому правила
 * публікує Discord проєкту: "# N. Розділ", "**1.1 Текст пункту**" і блоки
 * ```diff з рядками "- [покарання]" та "! примітка". Оновити правила =
 * вставити свіжий текст із Discord у відповідний файл, без правки коду.
 *
 * Книги: власні правила родини Monsory (kind=family — шкала покарань
 * родини) і правила проєкту Верба Онлайн для довідки (kind=project).
 */
class FamilyRules
{
    /** @return array<int,array{slug:string,title:string,short:string,icon:string,kind:string,file:string,description:string,updatedAt:string}> */
    public static function books(): array
    {
        return [
            [
                'slug' => 'monsory',
                'title' => 'Правила родини Monsory',
                'short' => 'Родина',
                'icon' => '👑',
                'kind' => 'family',
                'file' => 'monsory.md',
                'description' => 'Внутрішні правила родини: зауваження, штрафи, догани, пониження й виключення. Діють разом із правилами проєкту.',
                'updatedAt' => '2026-09-25',
            ],
            [
                'slug' => 'bizwar',
                'title' => 'Правила бізвару',
                'short' => 'Бізвар',
                'icon' => '⚔️',
                'kind' => 'project',
                'file' => 'bizwar.md',
                'description' => 'Правила війни за бізнес проєкту Верба Онлайн. Пункт 2.13 (дистанція на підготовці) скасовано 20.08.2026.',
                'updatedAt' => '2026-08-20',
            ],
            [
                'slug' => 'families',
                'title' => 'Правила сімей',
                'short' => 'Сім\'ї',
                'icon' => '🏛️',
                'kind' => 'project',
                'file' => 'families.md',
                'description' => 'Правила сімей проєкту Верба Онлайн: обов\'язки лідера, поведінка учасників, догани сім\'ї та їх зняття.',
                'updatedAt' => '2026-09-03',
            ],
            [
                'slug' => 'server',
                'title' => 'Правила сервера',
                'short' => 'Сервер',
                'icon' => '🌐',
                'kind' => 'project',
                'file' => 'server.md',
                'description' => 'Загальні правила проєкту Верба Онлайн з урахуванням змін до 24.09.2026. Розділи 4 і 5 — лише ті пункти, що є в нашій копії правил.',
                'updatedAt' => '2026-09-24',
            ],
            [
                'slug' => 'regulations',
                'title' => 'Окремі регламенти',
                'short' => 'Регламенти',
                'icon' => '📌',
                'kind' => 'project',
                'file' => 'regulations.md',
                'description' => 'Зміни з каналу «зміни в правилах», що стосуються лідерів і Військової частини.',
                'updatedAt' => '2026-09-21',
            ],
        ];
    }

    /**
     * Короткі назви порушень за пунктами правил родини — для видачі
     * покарань і сповіщень ("п. 2.1 · НРП нік"), без повного тексту
     * правила. У списку вибору лише ці пункти: загальні положення
     * (1.1, 2.4, 8.1…) — не порушення, за них не карають.
     */
    public const SHORT_LABELS = [
        '1.5' => 'Публічні суперечки щодо покарання',
        '2.1' => 'НРП нік',
        '2.2' => 'Немає акаунта на сайті / застосунку',
        '2.3' => 'Неактив без попередження',
        '2.5' => 'Передача / продаж акаунта',
        '2.6' => 'Твінк у ворожій сім\'ї, шпигунство',
        '3.1' => 'Образа, неповага',
        '3.2' => 'Невиконання наказу',
        '3.3' => 'Злив внутрішньої інформації',
        '3.4' => 'Конфлікт / стрільба по своїх',
        '3.5' => 'Провокації, токсичність від імені родини',
        '3.6' => 'DM / DB / SK у GZ',
        '3.7' => 'Поїздка на ВЧ',
        '3.8' => 'Блокування входів транспортом',
        '3.9' => 'Спам, флуд у чатах',
        '4.1' => 'Неявка на збір',
        '4.2' => 'Запізнення на збір',
        '4.3' => 'Вихід з гри / AFK у бою',
        '4.4' => 'Самовільний забив чи атака',
        '4.5' => 'Порушення правил бізвару',
        '4.7' => 'Вихід з родини під час бізвару',
        '4.8' => 'Злив бізвару',
        '5.2' => 'Фейковий звіт',
        '5.3' => 'Неправдивий звіт «за друга»',
        '5.4' => 'Махінації з банком родини',
        '5.5' => 'Шахрайство, неповернений борг',
        '5.6' => 'Несплата штрафу',
        '6.1' => 'Самовільно взяв зі складу',
        '6.2' => 'Крадіжка майна родини',
        '6.3' => 'Кинув / розбив сімейне авто',
        '6.4' => 'Легалізація нечесного майна',
        '7.2' => 'Призначення без доказів',
        '7.3' => 'Упереджене покарання',
        '7.4' => 'Зловживання повноваженнями',
        '7.5' => 'Прийом з ЧС / продаж посад',
        '7.6' => 'Затвердження звіту без перевірки',
        '8.2' => '3 зауваження → догана',
    ];

    public static function shortLabel(?string $code): ?string
    {
        return $code !== null ? (self::SHORT_LABELS[$code] ?? null) : null;
    }

    /** Шкала покарань родини — для легенди й кольору бейджів. */
    public static function levels(): array
    {
        return [
            ['key' => 'remark', 'title' => 'Зауваження', 'description' => 'Легке порушення. 3 активні зауваження = 1 догана. Згорає через 7 днів без нових порушень.'],
            ['key' => 'fine', 'title' => 'Штраф', 'description' => 'Грошове стягнення за пунктом правил. Сплатити протягом 48 годин на рахунок, який вкаже керівництво. Несплата — догана й подвоєння суми.'],
            ['key' => 'reprimand', 'title' => 'Догана', 'description' => 'Діє 14 днів. Поки є активна догана — премія за тиждень нараховується на 50%, підвищення неможливе. Максимум 3/3.'],
            ['key' => 'demotion', 'title' => 'Пониження', 'description' => 'Пониження на одну посаду або до Стажера — за порушення, пов\'язані з обов\'язками посади.'],
            ['key' => 'kick', 'title' => 'Виключення', 'description' => 'Виключення з родини: автоматично при 3/3 доганах або одразу за грубі порушення. Повернення — не раніше ніж через 14 днів і лише за рішенням Директора.'],
            ['key' => 'blacklist', 'title' => 'Чорний список', 'description' => 'Виключення без права повернення й внесення до чорного списку родини та Союзу сімей — за злив, шахрайство, зраду.'],
        ];
    }

    /**
     * Правила активної родини в тому ж форматі Discord: її власний текст
     * (керування родиною → Профіль родини). Для першої родини (Monsory),
     * поки текст не редагували, — файл resources/rules/monsory.md.
     */
    public static function familyMarkdown(): string
    {
        $stored = Setting::get(self::familyRulesKey());
        if ($stored !== null) {
            return $stored;
        }

        return self::isDefaultFamily() ? (string) @file_get_contents(self::path('monsory.md')) : '';
    }

    public static function saveFamilyMarkdown(?string $markdown): void
    {
        Setting::set(self::familyRulesKey(), $markdown !== null && trim($markdown) !== '' ? $markdown : null, 'content');
    }

    private static function familyRulesKey(): string
    {
        return 'family.'.(\App\Families\FamilyContext::id() ?? 0).'.rules_md';
    }

    private static function isDefaultFamily(): bool
    {
        $id = \App\Families\FamilyContext::id();

        return $id === null || $id === \App\Families\FamilyContext::defaultId();
    }

    /**
     * Книги для активної родини: власні правила родини + правила проєкту
     * (Верба Онлайн — лише для родин цього проєкту).
     *
     * @return array<int,array<string,mixed>>
     */
    private static function booksForFamily(): array
    {
        $family = \App\Families\FamilyContext::family();
        $verba = ! $family || mb_strtolower((string) $family->project) === 'verba online';

        return collect(self::books())
            ->filter(fn ($b) => $b['kind'] === 'family' || $verba)
            ->map(function ($b) use ($family) {
                if ($b['kind'] !== 'family') {
                    return $b + ['markdown' => (string) @file_get_contents(self::path($b['file']))];
                }
                $name = $family->name ?? 'Monsory';

                return array_merge($b, [
                    // Monsory лишає свій slug — на нього посилається застосунок.
                    'slug' => self::isDefaultFamily() ? $b['slug'] : 'family',
                    'title' => "Правила родини {$name}",
                    'markdown' => self::familyMarkdown(),
                ]);
            })->values()->all();
    }

    /** Повна відповідь для сайту й застосунку. */
    public static function payload(): array
    {
        $books = self::booksForFamily();

        return Cache::rememberForever('family_rules.'.md5(json_encode(array_map(fn ($b) => [$b['slug'], $b['title'], md5($b['markdown'])], $books))), fn () => [
            'levels' => self::levels(),
            'books' => collect($books)->map(fn (array $book) => [
                'slug' => $book['slug'],
                'title' => $book['title'],
                'short' => $book['short'],
                'icon' => $book['icon'],
                'kind' => $book['kind'],
                'description' => $book['description'],
                'updatedAt' => $book['updatedAt'],
                'sections' => self::parse($book['markdown'], $book['kind']),
            ])->values()->all(),
        ]);
    }

    private static function path(string $file): string
    {
        return resource_path('rules/'.$file);
    }

    /**
     * Розбирає текст у форматі Discord-правил.
     *
     * @return array<int,array{title:string,rules:array<int,array{code:string,text:string,notes:list<string>,penalties:list<array{level:string,text:string}>}>}>
     */
    public static function parse(string $markdown, string $kind): array
    {
        $sections = [];
        $section = null;
        $rule = null;
        $inDiff = false;
        $pendingBold = null;

        $flushRule = function () use (&$rule, &$section) {
            if ($rule !== null && $section !== null) {
                $section['rules'][] = $rule;
            }
            $rule = null;
        };
        $flushSection = function () use (&$section, &$sections, $flushRule) {
            $flushRule();
            if ($section !== null) {
                $sections[] = $section;
            }
            $section = null;
        };

        foreach (preg_split('/\R/u', $markdown) as $raw) {
            $line = trim($raw);

            if (str_starts_with($line, '```')) {
                $inDiff = ! $inDiff;

                continue;
            }

            if ($inDiff) {
                if ($rule === null || $line === '') {
                    continue;
                }
                if (str_starts_with($line, '-')) {
                    $text = trim(trim(ltrim($line, '- ')), '[]');
                    $rule['penalties'][] = ['level' => self::levelFor($text, $kind), 'text' => $text];
                } elseif (str_starts_with($line, '!')) {
                    $rule['notes'][] = trim(ltrim($line, '! '));
                } else {
                    $rule['notes'][] = $line;
                }

                continue;
            }

            // Пункт, що в оригіналі розбитий на кілька рядків усередині **…**.
            if ($pendingBold !== null) {
                $pendingBold .= ' '.$line;
                if (str_ends_with($line, '**')) {
                    $line = $pendingBold;
                    $pendingBold = null;
                } else {
                    continue;
                }
            } elseif (str_starts_with($line, '**') && ! str_ends_with(rtrim($line), '**')) {
                $pendingBold = $line;

                continue;
            }

            if ($line === '') {
                continue;
            }

            if (preg_match('/^#{1,3}\s+(.+)$/u', $line, $m)) {
                $flushSection();
                $section = ['title' => trim($m[1]), 'rules' => []];

                continue;
            }

            if (preg_match('/^\*\*\s*(\d+(?:\.\d+)*)\.?\s+(.+?)\s*\*\*$/us', $line, $m)) {
                $flushRule();
                $section ??= ['title' => 'Загальне', 'rules' => []];
                $rule = ['code' => $m[1], 'text' => trim($m[2]), 'notes' => [], 'penalties' => []];

                continue;
            }

            // Звичайний рядок між пунктами — продовження тексту поточного пункту.
            if ($rule !== null) {
                $rule['text'] .= ' '.trim($line, '* ');
            }
        }

        $flushSection();

        return $sections;
    }

    /**
     * Рівень покарання для кольору бейджа — за найсуворішим ключовим
     * словом у тексті. Для правил проєкту шкала своя: бан/блокування —
     * найважче, решта (Jail, мут, kick, warn, попередження) — "jail".
     */
    public static function levelFor(string $text, string $kind): string
    {
        $t = mb_strtolower($text);

        if ($kind === 'project') {
            foreach (['бан', 'ban', 'блокуван', 'видалення сім', 'конфіскац', 'бізнес', 'розформув'] as $word) {
                if (str_contains($t, $word)) {
                    return 'ban';
                }
            }

            return 'jail';
        }

        $scale = [
            'blacklist' => ['чорний список', 'чс'],
            'kick' => ['виключ'],
            'demotion' => ['пониж', 'зняття з посади'],
            'reprimand' => ['догана', 'догани'],
            'fine' => ['штраф', 'анулювання', 'повернення', 'заборона'],
            'remark' => ['зауваж'],
        ];
        foreach ($scale as $level => $words) {
            foreach ($words as $word) {
                if (str_contains($t, $word)) {
                    return $level;
                }
            }
        }

        return 'remark';
    }
}
