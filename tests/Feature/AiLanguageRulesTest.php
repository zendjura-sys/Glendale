<?php

namespace Tests\Feature;

use App\Services\Ai\AiClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Кожен запит до ШІ несе правило грамотної української (без кальок і вигаданих слів). */
class AiLanguageRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_claude_and_openai_get_language_rules(): void
    {
        $settings = app(SiteSettings::class);
        $settings->putSecret('ai_key', 'sk-ant-test-key');
        Http::fake([
            'api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => 'Привіт']]]),
            'openrouter.ai/*' => Http::response(['choices' => [['message' => ['content' => 'Привіт']]]]),
        ]);
        app(AiClient::class)->complete('Ти помічник.', [['role' => 'user', 'content' => 'Привітайся']]);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'anthropic')
            && str_contains((string) $r['system'], 'Ти помічник.')
            && str_contains((string) $r['system'], 'без русизмів і калькувань'));

        $settings->put(['ai_provider' => 'openai', 'ai_base_url' => 'https://openrouter.ai/api/v1', 'ai_model' => 'meta/llama']);
        app(AiClient::class)->complete('Ти помічник.', [['role' => 'user', 'content' => 'Привітайся']]);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'openrouter')
            && str_contains((string) $r['messages'][0]['content'], 'перечитай текст'));
    }
}
