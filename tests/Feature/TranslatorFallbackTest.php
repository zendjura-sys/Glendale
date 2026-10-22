<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Translation;
use App\Models\User;
use App\Services\I18n\CatalogTranslator;
use App\Services\I18n\DeepL;
use App\Services\I18n\LibreTranslate;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Ліміт DeepL вичерпано (456 або used ≥ limit) — перекладає LibreTranslate; обидва недоступні — помилка.
 */
class TranslatorFallbackTest extends TestCase
{
    use RefreshDatabase;

    private const DEEPL_KEY = '0123456789abcdef0123456789abcdef0123:fx';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function libre(bool $up = true): void
    {
        app(SiteSettings::class)->put(['libretranslate_url' => 'http://lt.test']);
        Http::fake([
            'lt.test/languages' => $up
                ? Http::response([['code' => 'en', 'name' => 'English'], ['code' => 'uk', 'name' => 'Ukrainian'], ['code' => 'de', 'name' => 'German'], ['code' => 'pb', 'name' => 'Portuguese (Brazil)']])
                : Http::response([], 500),
            'lt.test/translate' => $up
                ? fn (Request $r) => Http::response(is_array($r['q'])
                    ? ['translatedText' => array_map(fn (string $t) => strtoupper($r['target']).':'.$t, $r['q'])]
                    : ['translatedText' => 'LT: '.$r['q'], 'detectedLanguage' => ['confidence' => 90, 'language' => 'en']])
                : Http::response(['error' => 'down'], 500),
        ]);
    }

    private function makePost(string $body): Post
    {
        $author = User::factory()->create();

        return Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => $body, 'visibility' => 'public']);
    }

    public function test_deepl_quota_exceeded_falls_back_to_libretranslate(): void
    {
        app(SiteSettings::class)->putSecret('deepl_key', self::DEEPL_KEY);
        Http::fake([
            'api-free.deepl.com/v2/languages*' => Http::response([['language' => 'UK'], ['language' => 'EN-US']]),
            'api-free.deepl.com/v2/translate' => Http::response(['message' => 'Quota exceeded'], 456),
        ]);
        $this->libre();
        $reader = User::factory()->create();

        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $this->makePost('Hello world')->id])
            ->assertOk()->assertJsonPath('translation', 'LT: Hello world')->assertJsonPath('same', false);
        $this->assertTrue(app(DeepL::class)->exhausted());

        // Далі DeepL до нового місяця не питаємо.
        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $this->makePost('Good night')->id])
            ->assertJsonPath('translation', 'LT: Good night');
        Http::assertSentCount(5); // мови DeepL, 456, мови LibreTranslate, два переклади LibreTranslate
        $this->actingAs($reader)->get('/feed')->assertInertia(fn ($page) => $page->where('site.translate', true));
    }

    public function test_usage_over_limit_translates_interface_with_libretranslate(): void
    {
        app(SiteSettings::class)->putSecret('deepl_key', self::DEEPL_KEY);
        Http::fake([
            'api-free.deepl.com/v2/languages*' => Http::response([['language' => 'DE']]),
            'api-free.deepl.com/v2/usage' => Http::sequence()
                ->push(['character_count' => 500000, 'character_limit' => 500000])
                ->push(['character_count' => 10, 'character_limit' => 500000]),
        ]);
        $this->libre();

        $result = app(CatalogTranslator::class)->run('de');

        $this->assertNull($result['error']);
        $this->assertGreaterThan(0, $result['translated']);
        // Підстановки повертаються як були, множина — по формах.
        $this->assertSame('DE:Кімнату «{0}» прибрано з усіх сімей.', Translation::query()->where('locale', 'de')->where('source', 'Кімнату «{0}» прибрано з усіх сімей.')->value('value'));
        $this->assertSame('DE:учасник|DE:учасники|DE:учасників', Translation::query()->where('locale', 'de')->where('source', 'учасник|учасники|учасників')->value('value'));
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'deepl.com/v2/translate'));
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'lt.test/translate') && $r['source'] === 'uk' && $r['format'] === 'html');
        $this->assertTrue(app(DeepL::class)->exhausted());

        // Новий місяць: лічильник DeepL обнулився — позначку знято.
        app(DeepL::class)->quota(true);
        $this->assertFalse(app(DeepL::class)->exhausted());
    }

    public function test_both_engines_down_shows_error_and_hides_button(): void
    {
        app(SiteSettings::class)->putSecret('deepl_key', self::DEEPL_KEY);
        Http::fake([
            'api-free.deepl.com/v2/languages*' => Http::response([['language' => 'UK'], ['language' => 'EN-US']]),
            'api-free.deepl.com/v2/translate' => Http::response([], 503),
        ]);
        $this->libre(up: false);
        $reader = User::factory()->create();

        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $this->makePost('Hello world')->id])
            ->assertUnprocessable()->assertJsonValidationErrors('text');
        $this->assertFalse(app(DeepL::class)->exhausted());

        app(DeepL::class)->markExhausted();
        $this->actingAs($reader)->get('/feed')->assertInertia(fn ($page) => $page->where('site.translate', false));
    }

    public function test_libretranslate_alone_enables_content_translation(): void
    {
        $this->libre();
        $this->actingAs(User::factory()->create())->get('/feed')->assertInertia(fn ($page) => $page->where('site.translate', true));
    }

    public function test_language_codes_are_mapped_between_deepl_and_libretranslate(): void
    {
        $this->assertSame(['en'], LibreTranslate::fromDeepL('EN-GB'));
        $this->assertSame(['pb', 'pt-BR', 'pt'], LibreTranslate::fromDeepL('PT-BR'));
        $this->assertSame(['zh-Hant', 'zt'], LibreTranslate::fromDeepL('ZH-HANT'));
        $this->assertSame(['pl'], LibreTranslate::fromDeepL('PL'));
        $this->assertSame('PT-BR', LibreTranslate::toDeepL('pb'));
        $this->assertSame('ZH-HANT', LibreTranslate::toDeepL('zt'));
        $this->assertSame('UK', LibreTranslate::toDeepL('uk'));
        $this->assertSame('pt', LibreTranslate::primary('pb'));
        $this->assertSame('en', LibreTranslate::primary('en'));

        $this->libre();
        $libre = app(LibreTranslate::class);
        $this->assertSame('pb', $libre->target('pt-BR'));
        $this->assertSame('en', $libre->target('en-GB'));
        $this->assertSame('de', $libre->target('de'));
        $this->assertNull($libre->target('ja'));
    }

    public function test_admin_sees_engines_and_checks_libretranslate(): void
    {
        $admin = User::factory()->admin()->create();
        app(SiteSettings::class)->putSecret('deepl_key', self::DEEPL_KEY);
        Http::fake([
            'api-free.deepl.com/v2/languages*' => Http::response([['language' => 'DE']]),
            'api-free.deepl.com/v2/usage' => Http::response(['character_count' => 500000, 'character_limit' => 500000]),
        ]);
        $this->libre();

        $this->actingAs($admin)->get('/admin/languages')->assertInertia(fn ($page) => $page
            ->where('active', 'libretranslate')
            ->where('deepl.exhausted', true)
            ->where('deepl.usage.used', 500000)
            ->where('libretranslate.up', true));
        $this->actingAs($admin)->post('/admin/languages/libretranslate/test')->assertRedirect();
        $this->assertSame('success', session('inertia.flash_data.toast.type'));
        $this->actingAs(User::factory()->create())->post('/admin/languages/libretranslate/test')->assertForbidden();
    }
}
