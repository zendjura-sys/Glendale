<?php

namespace App\Http\Controllers;

use App\Models\HelpVote;
use App\Support\Help\HelpCatalog;
use App\Support\I18n\Translations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Довідка для новачків (/help): розділи, статті й «Чи допомогла стаття?». Відкрита без входу.
 * Тексти — App\Support\Help\HelpCatalog; переклад пропсів робить Translations::tree (як для всього сайту).
 */
class HelpController extends Controller
{
    /** Статті «Популярне» на головній довідки. */
    private const POPULAR = [
        'start/registration', 'start/app-login', 'start/two-factor', 'music/upload',
        'cinema/watch', 'feed/composer', 'safety/sessions', 'support/tickets',
    ];

    /** Ключ сесії: статті, на які відвідувач уже відповів (щоб не накручувати лічильник). */
    private const VOTED = 'help.voted';

    public function __construct(private readonly HelpCatalog $help) {}

    public function index(): Response|JsonResponse
    {
        $categories = array_map(fn (array $c) => [
            ...$this->brief($c),
            'articles' => array_map(fn (array $a) => ['slug' => $a['slug'], 'title' => $a['title'], 'summary' => $a['summary']], $c['articles']),
        ], $this->help->categories());

        return $this->page('help/index', [
            'categories' => $categories,
            'popular' => $this->help->related(self::POPULAR),
        ], 'Довідка', 'Відповіді на питання про GameCon: реєстрація, профіль, друзі й чати, спільноти, кіно, музика, GameCon+ і безпека.');
    }

    public function category(string $category): Response|JsonResponse
    {
        $found = $this->help->category($category);
        abort_if($found === null, 404);

        return $this->page('help/category', [
            'category' => [
                ...$this->brief($found),
                'articles' => array_map(fn (array $a) => ['slug' => $a['slug'], 'title' => $a['title'], 'summary' => $a['summary']], $found['articles']),
            ],
            'categories' => array_map(fn (array $c) => $this->brief($c), $this->help->categories()),
        ], $found['title'], $found['summary']);
    }

    public function article(Request $request, string $category, string $article): Response|JsonResponse
    {
        $found = $this->help->article($category, $article);
        abort_if($found === null, 404);
        [$section, $entry] = $found;

        $slugs = array_column($section['articles'], 'slug');
        $index = (int) array_search($entry['slug'], $slugs, true);
        $sibling = fn (int $i) => isset($section['articles'][$i])
            ? ['slug' => $section['articles'][$i]['slug'], 'title' => $section['articles'][$i]['title']]
            : null;
        // У застосунку (API) сесії немає — голос там не зберігається.
        $voted = $request->hasSession() ? (array) $request->session()->get(self::VOTED, []) : [];

        return $this->page('help/article', [
            'category' => $this->brief($section),
            'article' => [
                'slug' => $entry['slug'],
                'title' => $entry['title'],
                'summary' => $entry['summary'],
                'blocks' => $entry['blocks'],
            ],
            'related' => $this->help->related($entry['related']),
            'prev' => $sibling($index - 1),
            'next' => $sibling($index + 1),
            'voted' => $voted[$this->key($section['slug'], $entry['slug'])] ?? null,
            'updated' => HelpCatalog::UPDATED,
        ], $entry['title'], $entry['summary']);
    }

    /** «Чи допомогла стаття?» — анонімно, одна відповідь на статтю за сесію. */
    public function vote(Request $request, string $category, string $article): RedirectResponse
    {
        abort_if($this->help->article($category, $article) === null, 404);
        $data = $request->validate(['helpful' => ['required', 'boolean']]);
        $key = $this->key($category, $article);
        $voted = (array) $request->session()->get(self::VOTED, []);

        if (! isset($voted[$key])) {
            $helpful = (bool) $data['helpful'];
            HelpVote::record($key, $helpful);
            $voted[$key] = $helpful ? 'up' : 'down';
            $request->session()->put(self::VOTED, $voted);
        }

        return back();
    }

    private function key(string $category, string $article): string
    {
        return $category.'/'.$article;
    }

    /**
     * @param  array{slug: string, title: string, summary: string, icon: string}  $category
     * @return array{slug: string, title: string, summary: string, icon: string}
     */
    private function brief(array $category): array
    {
        return ['slug' => $category['slug'], 'title' => $category['title'], 'summary' => $category['summary'], 'icon' => $category['icon']];
    }

    /**
     * Сторінка з назвою й описом для пошуковиків і прев’ю посилань (шаблон app.blade.php).
     *
     * @param  array<string, mixed>  $props
     */
    private function page(string $component, array $props, string $title, string $description): Response|JsonResponse
    {
        $t = app(Translations::class);
        // Застосунок читає ту саму довідку як JSON (переклад робить SetLocale).
        if (request()->expectsJson()) {
            return response()->json([...$props, 'title' => $title, 'description' => $description]);
        }

        return Inertia::render($component, $props)->withViewData([
            'seoTitle' => $t->line($title),
            'seoDescription' => $t->line($description),
        ]);
    }
}
