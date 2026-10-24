<?php

namespace Tests\Feature;

use App\Models\HelpVote;
use App\Models\User;
use App\Support\Help\HelpCatalog;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Довідка /help: відкрита гостям, розділи й статті з HelpCatalog, «Чи допомогла стаття?», карта сайту. */
class HelpCenterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_index_is_public_and_lists_categories_and_popular(): void
    {
        $count = count(app(HelpCatalog::class)->categories());

        $this->get('/help')->assertOk()
            ->assertSee('<title>Довідка · ', false)
            ->assertInertia(fn (Assert $page) => $page
                ->component('help/index')
                ->has('categories', $count)
                ->has('categories.0.articles')
                ->where('categories.0.slug', 'start')
                ->where('popular', fn ($popular) => count($popular) >= 4)
            );
    }

    public function test_every_category_and_article_renders(): void
    {
        foreach (app(HelpCatalog::class)->categories() as $category) {
            $this->get('/help/'.$category['slug'])->assertOk()->assertInertia(fn (Assert $page) => $page
                ->component('help/category')
                ->where('category.slug', $category['slug'])
                ->has('category.articles', count($category['articles']))
            );

            foreach ($category['articles'] as $article) {
                $this->get('/help/'.$category['slug'].'/'.$article['slug'])->assertOk()
                    ->assertSee('<meta name="description" content="'.e($article['summary']).'">', false)
                    ->assertInertia(fn (Assert $page) => $page
                        ->component('help/article')
                        ->where('article.title', $article['title'])
                        ->has('article.blocks', count($article['blocks']))
                        ->where('voted', null)
                    );
            }
        }
    }

    public function test_catalog_is_consistent(): void
    {
        $help = app(HelpCatalog::class);
        $categories = HelpCatalog::all();
        $this->assertGreaterThanOrEqual(12, count($categories));
        $this->assertSame(count($categories), count(array_unique(array_column($categories, 'slug'))));

        foreach ($categories as $category) {
            $this->assertMatchesRegularExpression('/^[a-z0-9-]+$/', $category['slug']);
            $this->assertGreaterThanOrEqual(3, count($category['articles']), $category['slug']);
            $this->assertLessThanOrEqual(8, count($category['articles']), $category['slug']);
            $slugs = array_column($category['articles'], 'slug');
            $this->assertSame(count($slugs), count(array_unique($slugs)), $category['slug']);

            foreach ($category['articles'] as $article) {
                $key = $category['slug'].'/'.$article['slug'];
                $this->assertMatchesRegularExpression('/^[a-z0-9-]+$/', $article['slug']);
                $this->assertNotSame('', $article['summary'], $key);
                $this->assertNotEmpty($article['blocks'], $key);
                // Пов’язані статті існують (усі модулі за замовчуванням увімкнені).
                $this->assertCount(count($article['related']), $help->related($article['related']), $key);
                // Посилання в тексті — лише на сторінки сайту; без фігурних дужок (вони — шаблони перекладу).
                foreach ($article['blocks'] as $block) {
                    foreach ([$block['text'] ?? null, ...($block['items'] ?? [])] as $text) {
                        if ($text === null) {
                            continue;
                        }
                        $this->assertStringNotContainsString('{', $text, $key);
                        preg_match_all('/\]\(([^)]*)\)/', $text, $links);
                        foreach ($links[1] as $href) {
                            $this->assertStringStartsWith('/', $href, $key);
                        }
                    }
                }
            }
        }
    }

    public function test_unknown_category_or_article_is_404(): void
    {
        $this->get('/help/nope')->assertNotFound();
        $this->get('/help/start/nope')->assertNotFound();
        $this->get('/help/nope/registration')->assertNotFound();
        $this->post('/help/start/nope/vote', ['helpful' => true])->assertNotFound();
    }

    public function test_disabled_module_hides_its_category(): void
    {
        app(ModuleManager::class)->set('music', false);

        $this->get('/help/music')->assertNotFound();
        $this->get('/help/music/upload')->assertNotFound();
        $this->get('/help')->assertInertia(fn (Assert $page) => $page
            ->where('categories', fn ($categories) => ! collect($categories)->contains('slug', 'music'))
        );
    }

    public function test_signed_in_user_sees_help_too(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/help/start/app-login')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('help/article')->where('category.slug', 'start'));
    }

    public function test_vote_is_anonymous_and_counted_once_per_session(): void
    {
        $this->from('/help/start/login')->post('/help/start/login/vote', ['helpful' => true])->assertRedirect('/help/start/login');
        $this->post('/help/start/login/vote', ['helpful' => false])->assertRedirect();

        $vote = HelpVote::query()->where('article', 'start/login')->firstOrFail();
        $this->assertSame(1, $vote->helpful);
        $this->assertSame(0, $vote->unhelpful);

        $this->get('/help/start/login')->assertInertia(fn (Assert $page) => $page->where('voted', 'up'));

        $this->post('/help/start/registration/vote', ['helpful' => false]);
        $this->assertSame(1, HelpVote::query()->where('article', 'start/registration')->value('unhelpful'));

        $this->post('/help/start/login/vote', ['helpful' => 'maybe'])->assertSessionHasErrors('helpful');
    }

    public function test_sitemap_includes_help_pages(): void
    {
        $xml = $this->get('/sitemap.xml')->assertOk()->getContent();

        $this->assertStringContainsString('<loc>'.url('/help').'</loc>', $xml);
        $this->assertStringContainsString('<loc>'.url('/help/music').'</loc>', $xml);
        $this->assertStringContainsString('<loc>'.url('/help/start/app-login').'</loc>', $xml);
        $this->assertNotFalse(simplexml_load_string($xml));
    }
}
