<?php

namespace Tests\Feature;

use App\Models\Translation;
use App\Models\User;
use App\Support\I18n\Locales;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminLanguagesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        app(SiteSettings::class)->putSecret('deepl_key', '0123456789abcdef0123456789abcdef0123:fx');
        Http::preventStrayRequests();
        Http::fake([
            'api-free.deepl.com/v2/languages*' => Http::response([['language' => 'EN-US'], ['language' => 'DE'], ['language' => 'PT-BR'], ['language' => 'PT-PT']]),
            'api-free.deepl.com/v2/usage' => Http::response(['character_count' => 1000, 'character_limit' => 500000]),
            // «Переклад» — префікс мови; підстановки в <x> мають повернутися як є.
            'api-free.deepl.com/v2/translate' => function (Request $request) {
                $target = $request['target_lang'];

                return Http::response(['translations' => array_map(fn (string $t) => ['text' => $target.':'.$t], $request['text'])]);
            },
        ]);
    }

    public function test_admin_adds_languages_translates_with_deepl_and_enables_them(): void
    {
        $this->actingAs(User::factory()->create())->get('/admin/languages')->assertForbidden();

        $this->actingAs($this->admin)->post('/admin/languages', ['codes' => ['xx']])->assertSessionHasErrors('codes');
        $this->actingAs($this->admin)->post('/admin/languages', ['codes' => ['en', 'pt_br']])->assertSessionHasNoErrors();

        // Переклад готовий, але мова ще вимкнена.
        $this->assertSame(['uk'], app(Locales::class)->enabled());
        $this->assertSame('EN-US:Кімнату «{0}» прибрано з усіх сімей.', Translation::query()->where('locale', 'en')->where('source', 'Кімнату «{0}» прибрано з усіх сімей.')->value('value'));
        $this->assertSame('EN-US:учасник|EN-US:учасники|EN-US:учасників', Translation::query()->where('locale', 'en')->where('source', 'учасник|учасники|учасників')->value('value'));
        $this->assertSame('PT-BR:Сім’ї', Translation::query()->where('locale', 'pt-BR')->where('source', 'Сім’ї')->value('value'));
        Http::assertSent(fn (Request $r) => str_contains($r->url(), '/v2/translate') && in_array('Поле <x>:attribute</x> обов\'язкове.', $r['text'] ?? [], true));

        $this->actingAs($this->admin)->patch('/admin/languages/en', ['enabled' => true])->assertSessionHasNoErrors();
        $this->assertSame(['uk', 'en'], app(Locales::class)->enabled());
        $this->actingAs($this->admin)->get('/admin/languages')->assertInertia(fn (Assert $page) => $page
            ->component('admin/languages')
            ->where('languages.0.code', 'en')
            ->where('languages.0.enabled', true)
            ->where('deepl.usage.used', 1000));

        // Відповіді сервера — англійською.
        $this->getJson('/events', ['Accept-Language' => 'en'])->assertUnauthorized();
        $user = User::factory()->create();
        $user->forceFill(['locale' => 'en'])->save();
        $this->actingAs($user)->getJson('/events')->assertJsonPath('kinds.family', 'EN-US:Сім’ї');

        // Повідомлення валідації Laravel — з каталогу.
        app(SiteSettings::class)->put(['languages' => [['code' => 'en', 'enabled' => true], ['code' => 'pt-BR', 'enabled' => true]]]);
        $this->assertSame("PT-BR:Поле nome обов'язкове.", __('validation.required', ['attribute' => 'nome'], 'pt-BR'));
    }

    public function test_manual_fix_survives_retranslation_and_can_be_reset(): void
    {
        app(SiteSettings::class)->put(['languages' => [['code' => 'de', 'enabled' => true]]]);
        $this->actingAs($this->admin)->post('/admin/languages/de/translate')->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->put('/admin/languages/de/strings', ['source' => 'Сім’ї', 'value' => 'Familien'])->assertSessionHasNoErrors();

        $this->actingAs($this->admin)->post('/admin/languages/de/translate', ['all' => true]);
        $this->assertSame('Familien', Translation::query()->where('locale', 'de')->where('source', 'Сім’ї')->value('value'));

        $this->actingAs($this->admin)->get('/admin/languages/de/strings?filter=manual')
            ->assertInertia(fn (Assert $page) => $page->component('admin/language-strings')->where('total', 1)->where('items.0.value', 'Familien'));
        $this->actingAs($this->admin)->get('/admin/languages/de/strings?q=Familien')
            ->assertInertia(fn (Assert $page) => $page->where('items.0.source', 'Сім’ї'));

        // Порожнє — повертаємо автопереклад (рядок прибирається до наступного проходу).
        $this->actingAs($this->admin)->put('/admin/languages/de/strings', ['source' => 'Сім’ї', 'value' => '']);
        $this->assertNull(Translation::query()->where('locale', 'de')->where('source', 'Сім’ї')->first());
        $this->actingAs($this->admin)->put('/admin/languages/de/strings', ['source' => 'Чужий рядок', 'value' => 'x'])->assertNotFound();

        $this->actingAs($this->admin)->put('/admin/languages/settings', ['default_locale' => 'de'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->delete('/admin/languages/de')->assertSessionHasNoErrors();
        $this->assertSame(0, Translation::query()->where('locale', 'de')->count());
        $this->assertSame('uk', app(Locales::class)->fallback());
    }
}
