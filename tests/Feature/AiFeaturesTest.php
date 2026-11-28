<?php

namespace Tests\Feature;

use App\Models\ChatAutomation;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\MessageReport;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** ШІ з власним ключем: Claude чи OpenAI-сумісний сервіс, переписування, підсумок, бот, оцінка скарг. */
class AiFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private string $reply = 'Готово';

    private function claude(string $text = 'Готово'): void
    {
        $this->reply = $text;
        app(SiteSettings::class)->putSecret('ai_key', 'sk-ant-test-key');
        Http::fake(['api.anthropic.com/*' => fn () => Http::response([
            'content' => [['type' => 'text', 'text' => $this->reply]],
            'stop_reason' => 'end_turn',
        ])]);
    }

    /** @return array{0: Conversation, 1: User, 2: User} */
    private function group(): array
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        app(FriendshipService::class)->request($owner, $member);
        app(FriendshipService::class)->accept($member, $owner);

        return [app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]), $owner, $member];
    }

    public function test_ai_plugins_are_off_without_key(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/ai/rewrite', ['text' => 'прівіт', 'mode' => 'fix'])->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_rewrite_calls_claude_with_effort_and_fallback(): void
    {
        $this->claude('Привіт!');
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/ai/rewrite', ['text' => 'прівіт', 'mode' => 'fix'])
            ->assertOk()->assertJsonPath('text', 'Привіт!');

        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.anthropic.com/v1/messages'
            && $request->header('x-api-key')[0] === 'sk-ant-test-key'
            && $request['model'] === 'claude-opus-5-5'
            && $request['output_config'] === ['effort' => 'low']
            && $request['fallbacks'] === 'default'
            && ! isset($request['temperature']));
        $this->actingAs($user)->postJson('/ai/rewrite', ['text' => 'x', 'mode' => 'poem'])->assertUnprocessable();
    }

    public function test_openai_compatible_provider_and_errors(): void
    {
        $settings = app(SiteSettings::class);
        $settings->putSecret('ai_key', 'or-key');
        $settings->put(['ai_provider' => 'openai', 'ai_base_url' => 'https://openrouter.ai/api/v1', 'ai_model' => 'meta/llama']);
        Http::fake([
            'openrouter.ai/*' => Http::sequence()
                ->push(['choices' => [['message' => ['content' => 'Hello!']]]])
                ->push(['error' => 'bad key'], 401),
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/ai/rewrite', ['text' => 'Привіт', 'mode' => 'en'])
            ->assertOk()->assertJsonPath('text', 'Hello!');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer or-key')
            && $request['messages'][0]['role'] === 'system');

        $this->actingAs($user)->postJson('/ai/rewrite', ['text' => 'Привіт', 'mode' => 'en'])
            ->assertUnprocessable()->assertJsonPath('message', 'ШІ відхилив ключ. Перевірте його в адмінці.');
    }

    public function test_summary_for_group_members_only_and_cached(): void
    {
        $this->claude('• Домовились про рейд о 21:00');
        [$chat, $owner, $member] = $this->group();
        app(Messenger::class)->send($chat, $owner, 'Рейд о 21:00?');
        app(Messenger::class)->send($chat, $member, 'Так, я в ділі');

        $this->actingAs($member)->postJson("/messages/{$chat->id}/ai/summary")
            ->assertOk()->assertJsonPath('summary', '• Домовились про рейд о 21:00');
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/ai/summary")->assertOk();
        Http::assertSentCount(1);

        $stranger = User::factory()->create();
        $this->actingAs($stranger)->postJson("/messages/{$chat->id}/ai/summary")->assertNotFound();
    }

    public function test_ai_bot_answers_when_called(): void
    {
        $this->claude('Збір о 21:00 у голосовому.');
        [$chat, $owner, $member] = $this->group();

        $this->actingAs($member)->putJson("/messages/{$chat->id}/bots/ai", ['enabled' => true])->assertForbidden();
        $this->actingAs($owner)->putJson("/messages/{$chat->id}/bots/ai", [
            'enabled' => true, 'bot_name' => 'Тренер', 'body' => 'Ти тренер з CS2.',
        ])->assertOk()->assertJsonPath('ai.bot_name', 'Тренер');

        // Відповідь іде після відповіді сервера — тож пишемо через запит.
        $this->actingAs($member)->post("/messages/{$chat->id}", ['body' => 'Просто балачка']);
        Http::assertNothingSent();

        $this->actingAs($member)->post("/messages/{$chat->id}", ['body' => '/ші коли збір?']);
        $last = $chat->messages()->latest('id')->firstOrFail();
        $this->assertNull($last->user_id);
        $this->assertSame('Тренер', $last->meta['bot']['name']);
        $this->assertSame('Збір о 21:00 у голосовому.', $last->body);
        Http::assertSent(fn (Request $request) => str_contains((string) $request['system'], 'Ти тренер з CS2.'));

        $this->actingAs($member)->post("/messages/{$chat->id}", ['body' => 'Дякую, @Тренер']);
        $this->assertSame(2, $chat->messages()->whereNotNull('meta->bot')->count());
        $this->assertSame(1, ChatAutomation::query()->where('kind', ChatAutomation::AI)->count());
    }

    public function test_report_gets_ai_verdict_and_community_description(): void
    {
        $this->claude('{"severity":"high","reason":"Погрози гравцеві"}');
        app(SiteSettings::class)->put(['plugins' => ['ai_moderation' => true]]);
        [$chat, $owner, $member] = $this->group();
        $message = app(Messenger::class)->send($chat, $member, 'Знайду тебе після матчу');

        $this->actingAs($owner)->postJson("/messages/{$chat->id}/messages/{$message->id}/report", ['reason' => 'abuse'])->assertSuccessful();
        $report = MessageReport::query()->firstOrFail();
        $this->assertSame(['severity' => 'high', 'reason' => 'Погрози гравцеві'], $report->ai_verdict);

        $this->reply = 'Спільнота для тих, хто грає в CS2.';
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'CS2 UA', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
        $this->actingAs($member)->postJson("/c/{$community->slug}/ai/description")->assertForbidden();
        $this->actingAs($owner)->postJson("/c/{$community->slug}/ai/description")
            ->assertOk()->assertJsonPath('text', 'Спільнота для тих, хто грає в CS2.');
    }
}
