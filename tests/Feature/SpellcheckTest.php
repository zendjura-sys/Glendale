<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Spellcheck\Spellchecker;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

class SpellcheckTest extends TestCase
{
    use RefreshDatabase;

    /** Hunspell підмінений: Process::fake повертає відповідь у форматі «hunspell -a». */
    private function fakeHunspell(string $output): void
    {
        config(['services.hunspell.path' => PHP_BINARY, 'services.hunspell.dictionaries' => 'uk_UA']);
        Process::fake(['*' => Process::result("@(#) International Ispell Version 3.2.06 (but really Hunspell 1.7.2)\n".$output)]);
    }

    private function moderator(): User
    {
        return User::factory()->create(['role' => User::ROLE_MODERATOR]);
    }

    public function test_only_staff_can_check_and_only_admins_add_words(): void
    {
        $this->fakeHunspell("*\n\n");
        $this->postJson('/admin/spellcheck', ['text' => 'Привіт'])->assertUnauthorized();
        $this->actingAs(User::factory()->create())->postJson('/admin/spellcheck', ['text' => 'Привіт'])->assertForbidden();
        $this->actingAs($this->moderator())->postJson('/admin/spellcheck', ['text' => 'Привіт'])->assertOk()->assertJsonPath('can_add', false);
        $this->actingAs(User::factory()->admin()->create())->postJson('/admin/spellcheck', ['text' => 'Привіт'])->assertOk()->assertJsonPath('can_add', true);

        $this->actingAs($this->moderator())->postJson('/admin/spellcheck/words', ['word' => 'капт'])->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->postJson('/admin/spellcheck/words', ['word' => 'a b'])->assertJsonValidationErrors('word');
    }

    public function test_hunspell_output_is_parsed_with_utf16_offsets_and_allowlist(): void
    {
        // Рядок 1: «^Модератр заблокував акаунт» → помилки «Модератр» і «акаунт» (у словнику GameCon).
        // Рядок 2: «^😀 Привт» → «Привт» (емодзі — дві кодові одиниці UTF-16).
        $this->fakeHunspell("& Модератр 3 1: Модератор, Модерато\n*\n& акаунт 2 21: акант, аканту\n\n*\n# Привт 3\n\n");

        $response = $this->actingAs($this->moderator())->postJson('/admin/spellcheck', ['text' => "Модератр заблокував акаунт\n😀 Привт"])
            ->assertOk()->assertJsonPath('engine', 'hunspell')->assertJsonCount(2, 'issues');
        $response->assertJsonPath('issues.0.word', 'Модератр')
            ->assertJsonPath('issues.0.offset', 0)
            ->assertJsonPath('issues.0.suggestions', ['Модератор', 'Модерато'])
            ->assertJsonPath('issues.1.word', 'Привт')
            ->assertJsonPath('issues.1.offset', 30)
            ->assertJsonPath('issues.1.length', 5)
            ->assertJsonPath('issues.1.suggestions', []);
        Process::assertRan(fn ($process) => in_array('-a', (array) $process->command, true) && str_starts_with((string) $process->input, '^Модератр'));
    }

    public function test_admin_words_and_languagetool_grammar_are_merged(): void
    {
        $this->fakeHunspell("& бізнесвар 1 1: бізнес\n*\n\n");
        app(SiteSettings::class)->put(['languagetool_url' => 'http://lt-grammar.test']);
        Http::preventStrayRequests();
        Http::fake(['lt-grammar.test/v2/check' => Http::response(['matches' => [
            ['offset' => 10, 'length' => 6, 'message' => 'Можлива граматична помилка', 'replacements' => [['value' => 'гравців']], 'rule' => ['id' => 'X', 'issueType' => 'grammar']],
            ['offset' => 0, 'length' => 9, 'message' => 'Орфографія', 'replacements' => [], 'rule' => ['id' => 'MORFOLOGIK', 'issueType' => 'misspelling']],
        ]])]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->postJson('/admin/spellcheck', ['text' => 'бізнесвар гравця'])
            ->assertOk()->assertJsonPath('engine', 'languagetool')->assertJsonCount(2, 'issues')
            ->assertJsonPath('issues.0.word', 'бізнесвар')->assertJsonPath('issues.0.rule', 'spelling')
            ->assertJsonPath('issues.1.word', 'гравця')->assertJsonPath('issues.1.rule', 'grammar');
        Http::assertSent(fn (Request $r) => $r['language'] === 'uk-UA' && $r['text'] === 'бізнесвар гравця');

        // Слово додано до словника — більше не помилка (ні в Hunspell, ні в LanguageTool).
        $this->actingAs($admin)->postJson('/admin/spellcheck/words', ['word' => 'бізнесвар'])->assertOk();
        $this->assertStringContainsString('бізнесвар', (string) app(SiteSettings::class)->get('spellcheck_words'));
        $this->actingAs($admin)->postJson('/admin/spellcheck', ['text' => 'бізнесвар гравця'])
            ->assertJsonCount(1, 'issues')->assertJsonPath('issues.0.rule', 'grammar');
    }

    public function test_languagetool_failure_falls_back_to_hunspell(): void
    {
        $this->fakeHunspell("# Привт 1\n\n");
        app(SiteSettings::class)->put(['languagetool_url' => 'http://lt-grammar.test']);
        Http::fake(['lt-grammar.test/*' => Http::response(['message' => 'limit'], 429)]);

        $this->actingAs($this->moderator())->postJson('/admin/spellcheck', ['text' => 'Привт'])
            ->assertOk()->assertJsonPath('engine', 'hunspell')->assertJsonPath('issues.0.word', 'Привт');
    }

    public function test_real_hunspell_finds_mistakes_and_respects_gamecon_dictionary(): void
    {
        $spell = app(Spellchecker::class);
        if (! $spell->available() || ! in_array('uk_UA', $spell->dictionaries(), true)) {
            $this->markTestSkipped('hunspell з uk_UA не встановлено');
        }

        $result = $spell->check("Модератр заблокував акаунта за бізвар у GTA RP.\n😀 Привт, https://gamecon.online/abcxyz @nickk");
        $words = array_column($result['issues'], 'word');

        $this->assertSame(['Модератр', 'Привт'], $words);
        $this->assertSame(0, $result['issues'][0]['offset']);
        $this->assertContains('Модератор', $result['issues'][0]['suggestions']);
        $this->assertSame(51, $result['issues'][1]['offset']);
    }
}
