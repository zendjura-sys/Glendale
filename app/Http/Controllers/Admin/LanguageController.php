<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\TranslateLanguage;
use App\Models\Translation;
use App\Services\I18n\CatalogTranslator;
use App\Services\I18n\DeepL;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка → Мови: додати мову за кодом (uk-UA, pt-BR…), автопереклад DeepL,
 * увімкнути/вимкнути мову, типова мова, ручні правки перекладів.
 */
class LanguageController extends Controller
{
    /** Рекомендований набір мов. */
    public const SUGGESTED = ['en', 'de', 'es', 'it', 'pl', 'pt', 'zh', 'ja', 'ko'];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly Locales $locales,
        private readonly DeepL $deepl,
        private readonly CatalogTranslator $translator,
        private readonly Translations $translations,
    ) {}

    public function index(): Response
    {
        $languages = array_map(fn (array $row) => [
            'code' => $row['code'],
            'native' => Locales::nativeName($row['code']),
            'name' => Locales::ukrainianName($row['code']),
            'enabled' => $row['enabled'],
            'deepl' => $this->deepl->target($row['code']) !== null,
            'stats' => $this->translator->stats($row['code']),
            'progress' => $this->translator->progress($row['code']),
        ], $this->locales->configured());

        return Inertia::render('admin/languages', [
            'languages' => $languages,
            'default_locale' => $this->locales->fallback(),
            'suggested' => array_values(array_map(fn (string $code) => ['code' => $code, 'native' => Locales::nativeName($code)], array_diff(self::SUGGESTED, array_column($languages, 'code')))),
            'deepl' => [
                'configured' => $this->deepl->configured(),
                'usage' => $this->deepl->configured() ? $this->deepl->usage() : null,
            ],
            'catalog' => count($this->translations->catalog()),
            'content_translation' => $this->settings->get('content_translation') !== false,
        ]);
    }

    /** Додати одну чи кілька мов: «uk-UA», «pt-BR», «ko». */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['codes' => ['required', 'array', 'min:1', 'max:30'], 'codes.*' => ['required', 'string', 'max:16']]);
        $current = $this->locales->configured();
        $known = array_column($current, 'code');
        $added = [];
        foreach ($data['codes'] as $raw) {
            $code = Locales::normalize((string) $raw);
            if ($code === null || ! Locales::exists($code)) {
                return back()->withErrors(['codes' => "Невідомий код мови «{$raw}». Приклади: en, de, pt-BR, zh-Hans."]);
            }
            if ($code === Locales::SOURCE) {
                return back()->withErrors(['codes' => 'Українська — основна мова сайту, її додавати не треба.']);
            }
            if (! in_array($code, $known, true)) {
                // Поки переклад не готовий — мова вимкнена.
                $current[] = ['code' => $code, 'enabled' => false];
                $known[] = $code;
                $added[] = $code;
            }
        }
        $this->settings->put(['languages' => $current]);
        foreach ($added as $code) {
            if ($this->deepl->configured() && $this->deepl->target($code) !== null) {
                TranslateLanguage::dispatch($code);
            }
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $added === [] ? 'Ці мови вже додано.' : 'Мови додано. Автопереклад запущено — увімкніть мову, коли він завершиться.']);

        return back();
    }

    public function update(Request $request, string $code): RedirectResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $languages = $this->find($code);
        foreach ($languages as &$row) {
            if ($row['code'] === $code) {
                $row['enabled'] = (bool) $data['enabled'];
            }
        }
        unset($row);
        $this->settings->put(['languages' => $languages]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['enabled'] ? 'Мову увімкнено.' : 'Мову вимкнено: відвідувачі з нею побачать типову мову.']);

        return back();
    }

    public function destroy(string $code): RedirectResponse
    {
        $languages = array_values(array_filter($this->find($code), fn (array $row) => $row['code'] !== $code));
        $this->settings->put(['languages' => $languages]);
        Translation::query()->where('locale', $code)->delete();
        $this->translations->touch($code);
        if ($this->settings->get('default_locale') === $code) {
            $this->settings->put(['default_locale' => Locales::SOURCE]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Мову й переклади видалено.']);

        return back();
    }

    /** Докласти переклади нових рядків або (all) перекласти все, крім ручних правок. */
    public function translate(Request $request, string $code): RedirectResponse
    {
        $this->find($code);
        if (! $this->deepl->configured()) {
            return back()->withErrors(['deepl' => 'Додайте ключ DeepL в Адмінці → Інтеграції.']);
        }
        TranslateLanguage::dispatch($code, $request->boolean('all'));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Автопереклад запущено.']);

        return back();
    }

    public function settings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'default_locale' => ['sometimes', 'string', Rule::in($this->locales->enabled())],
            'content_translation' => ['sometimes', 'boolean'],
        ]);
        $this->settings->put(array_map(fn ($v) => is_string($v) ? $v : (bool) $v, $data));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування мов збережено.']);

        return back();
    }

    /** Редактор перекладів мови: пошук, фільтр «без перекладу» / «виправлені вручну». */
    public function strings(Request $request, string $code): Response
    {
        $this->find($code);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'filter' => ['nullable', Rule::in(['all', 'missing', 'manual'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $q = mb_strtolower(trim((string) ($filters['q'] ?? '')));
        $filter = $filters['filter'] ?? 'all';
        $rows = Translation::query()->where('locale', $code)->get(['hash', 'value', 'is_manual'])->keyBy('hash');

        $items = [];
        foreach ($this->translations->catalog() as $source) {
            $row = $rows->get(Translation::hashOf($source));
            if ($filter === 'missing' && $row !== null) {
                continue;
            }
            if ($filter === 'manual' && ! $row?->is_manual) {
                continue;
            }
            if ($q !== '' && ! str_contains(mb_strtolower($source), $q) && ! str_contains(mb_strtolower((string) $row?->value), $q)) {
                continue;
            }
            $items[] = ['source' => $source, 'value' => $row?->value, 'manual' => (bool) $row?->is_manual];
        }
        $perPage = 40;
        $page = (int) ($filters['page'] ?? 1);

        return Inertia::render('admin/language-strings', [
            'language' => ['code' => $code, 'native' => Locales::nativeName($code), 'name' => Locales::ukrainianName($code)],
            'items' => array_slice($items, ($page - 1) * $perPage, $perPage),
            'total' => count($items),
            'page' => $page,
            'pages' => max(1, (int) ceil(count($items) / $perPage)),
            'filters' => ['q' => $filters['q'] ?? '', 'filter' => $filter],
        ]);
    }

    /** Ручна правка: автопереклад її більше не перезапише. Порожнє — скинути до автоперекладу. */
    public function updateString(Request $request, string $code): RedirectResponse
    {
        $this->find($code);
        $data = $request->validate(['source' => ['required', 'string', 'max:5000'], 'value' => ['nullable', 'string', 'max:5000']]);
        abort_unless(in_array($data['source'], $this->translations->catalog(), true), 404);
        $hash = Translation::hashOf((string) $data['source']);
        $value = trim((string) ($data['value'] ?? ''));
        if ($value === '') {
            Translation::query()->where('locale', $code)->where('hash', $hash)->delete();
        } else {
            Translation::query()->updateOrCreate(['locale' => $code, 'hash' => $hash], ['source' => $data['source'], 'value' => $value, 'is_manual' => true]);
        }
        $this->translations->touch($code);
        Inertia::flash('toast', ['type' => 'success', 'message' => $value === '' ? 'Переклад скинуто.' : 'Переклад збережено.']);

        return back();
    }

    /**
     * @return list<array{code: string, enabled: bool}>
     */
    private function find(string $code): array
    {
        $languages = $this->locales->configured();
        abort_unless(in_array($code, array_column($languages, 'code'), true), 404);

        return $languages;
    }
}
