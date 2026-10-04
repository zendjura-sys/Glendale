<?php

namespace Tests\Feature;

use App\Models\Translation;
use App\Models\User;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocalizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app(SiteSettings::class)->put(['languages' => [
            ['code' => 'en', 'enabled' => true],
            ['code' => 'de', 'enabled' => true],
            ['code' => 'ru', 'enabled' => false],
        ]]);
    }

    private function translate(string $locale, array $pairs): void
    {
        foreach ($pairs as $source => $value) {
            Translation::query()->create(['locale' => $locale, 'hash' => Translation::hashOf($source), 'source' => $source, 'value' => $value]);
        }
        app(Translations::class)->touch($locale);
    }

    public function test_language_codes_are_normalized(): void
    {
        $this->assertSame('uk', Locales::normalize('ua-UA'));
        $this->assertSame('pt-BR', Locales::normalize('pt_br'));
        $this->assertSame('zh-Hans-CN', Locales::normalize('ZH-hans-cn'));
        $this->assertNull(Locales::normalize('english'));
        $this->assertTrue(Locales::exists('ko'));
        $this->assertFalse(Locales::exists('xx'));
        $this->assertSame('Deutsch', Locales::nativeName('de'));
    }

    public function test_browser_language_picks_enabled_locale_and_disabled_falls_back(): void
    {
        $this->get('/login', ['Accept-Language' => 'ru-RU,ru;q=0.9,de;q=0.8'])->assertHeader('Content-Language', 'de');
        $this->get('/login', ['Accept-Language' => 'en-GB,en;q=0.9'])->assertHeader('Content-Language', 'en');
        // Російська вимкнена — типова мова.
        $this->get('/login', ['Accept-Language' => 'ru'])->assertHeader('Content-Language', 'uk');
        app(SiteSettings::class)->put(['default_locale' => 'en']);
        $this->get('/login', ['Accept-Language' => 'ru'])->assertHeader('Content-Language', 'en');
    }

    public function test_manual_choice_is_saved_in_profile_and_cookie(): void
    {
        $this->post('/locale', ['locale' => 'de'])->assertCookie('locale', 'de', false);
        $this->post('/locale', ['locale' => 'ru'])->assertSessionHasErrors('locale');

        $user = User::factory()->create();
        $this->actingAs($user)->post('/locale', ['locale' => 'en'])->assertSessionHasNoErrors();
        $this->assertSame('en', $user->fresh()?->locale);
        $this->assertSame('en', app(Locales::class)->forUser($user->fresh() ?? $user));
        $this->actingAs($user->fresh() ?? $user)->get('/login', ['Accept-Language' => 'de'])->assertHeader('Content-Language', 'en');
    }

    public function test_server_texts_are_translated_exactly_or_by_pattern_but_user_content_is_not(): void
    {
        $this->translate('en', [
            'Сім’ї' => 'Families',
            'Кімнату «{0}» прибрано з усіх сімей.' => 'Room “{0}” was removed from all families.',
            'Найближчих подій немає' => 'No upcoming events',
        ]);
        $t = app(Translations::class);
        $this->assertSame('Families', $t->line('Сім’ї', 'en'));
        $this->assertSame('Room “Штаб” was removed from all families.', $t->line('Кімнату «Штаб» прибрано з усіх сімей.', 'en'));
        $this->assertSame('Сім’ї', $t->line('Сім’ї', 'uk'));
        $this->assertSame(['message' => 'Families', 'body' => 'Сім’ї'], $t->tree(['message' => 'Сім’ї', 'body' => 'Сім’ї'], 'en'));

        // Відповідь сервера перекладається мовою користувача.
        $user = User::factory()->create();
        $user->forceFill(['locale' => 'en'])->save();
        $this->actingAs($user)->getJson('/events')->assertOk()->assertJsonPath('kinds.family', 'Families');

        // Словник сайту — лише його рядки, з версією в адресі.
        $script = $this->get('/i18n/en.js')->assertOk()->assertHeader('Content-Type', 'application/javascript; charset=utf-8')->getContent();
        $this->assertStringContainsString('No upcoming events', (string) $script);
        $this->assertStringNotContainsString('was removed from all families', (string) $script);
        $this->get('/i18n/ru.js')->assertNotFound();
    }

    public function test_app_gets_its_dictionary_and_languages(): void
    {
        $this->getJson('/api/v1/i18n', ['X-Locale' => 'de'])->assertOk()
            ->assertJsonPath('locale', 'de')
            ->assertJsonPath('locales.0.code', 'uk')
            ->assertJsonPath('locales.0.native', 'Українська')
            ->assertJsonPath('locales.2.native', 'Deutsch');
    }
}
