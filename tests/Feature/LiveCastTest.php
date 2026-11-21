<?php

namespace Tests\Feature;

use App\Models\Livecast;
use App\Models\LivecastIntegration;
use App\Models\LivecastMessage;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** LiveCast — нативні відеостріми окремо від GameCast. */
class LiveCastTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Http::fake(['voice.gamecon.test/twirp/*' => Http::response([], 200)]);

        $settings = app(SiteSettings::class);
        $settings->put(['livekit_url' => 'wss://voice.gamecon.test', 'livekit_api_key' => 'APIgamecon']);
        $settings->putSecret('livekit_api_secret', 'test-livekit-secret-0123456789');
    }

    private function appToken(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    public function test_host_starts_from_app_with_donations_gifts_and_web_cannot_publish(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $hostToken = $this->appToken($host);
        $viewerToken = $this->appToken($viewer);

        // З сайту стрімити не можна.
        $this->actingAs($host)->postJson(route('livecast.store'), ['title' => 'Raid boss'])
            ->assertForbidden();

        $this->withToken($hostToken)->postJson('/api/v1/site/livecast', [
            'title' => 'Raid boss',
            'category' => 'MMO',
            'donations' => [
                ['provider' => 'donatik', 'url' => 'https://donatik.ua/streamer'],
                ['provider' => 'donatello', 'url' => 'https://donatello.to/streamer'],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('broadcast.title', 'Raid boss')
            ->assertJsonPath('broadcast.status', Livecast::LIVE)
            ->assertJsonCount(2, 'broadcast.donations')
            ->assertJsonPath('broadcast.donations.0.provider', 'donatik')
            ->assertJsonPath('broadcast.donations.1.provider', 'donatello');

        // Чужі майданчики (не Donatik/Donatello) відхиляє валідація.
        $this->withToken($hostToken)->postJson('/api/v1/site/livecast', [
            'title' => 'Other',
            'donations' => [
                ['provider' => 'donatepay', 'url' => 'https://donatepay.ru/@x'],
            ],
        ])->assertStatus(422);

        $stream = Livecast::query()->sole();

        // Ведучий з застосунку може публікувати.
        $token = $this->withToken($hostToken)->postJson("/api/v1/site/livecast/{$stream->id}/join")
            ->assertOk()
            ->json('token');
        $parts = explode('.', (string) $token);
        $payload = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/').str_repeat('=', (4 - strlen($parts[1]) % 4) % 4)), true);
        $this->assertEqualsCanonicalizing(
            ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
            $payload['video']['canPublishSources'] ?? [],
        );

        // Той самий ведучий через веб-маршрут — лише глядач (без publish).
        $webToken = $this->actingAs($host)->postJson(route('livecast.join', $stream))->assertOk()->json('token');
        $webParts = explode('.', (string) $webToken);
        $webPayload = json_decode((string) base64_decode(strtr($webParts[1], '-_', '+/').str_repeat('=', (4 - strlen($webParts[1]) % 4) % 4)), true);
        $this->assertFalse($webPayload['video']['canPublish'] ?? true);

        $viewerJoin = $this->withToken($viewerToken)->postJson("/api/v1/site/livecast/{$stream->id}/join")->assertOk()->json('token');
        $viewerParts = explode('.', (string) $viewerJoin);
        $viewerPayload = json_decode((string) base64_decode(strtr($viewerParts[1], '-_', '+/').str_repeat('=', (4 - strlen($viewerParts[1]) % 4) % 4)), true);
        $this->assertFalse($viewerPayload['video']['canPublish'] ?? true);

        $this->actingAs($viewer)->postJson(route('livecast.messages', $stream), ['body' => 'GG'])
            ->assertOk()
            ->assertJsonPath('messages.0.body', 'GG');

        $this->actingAs($viewer)->postJson(route('livecast.gifts', $stream), ['gift' => 'rose'])
            ->assertOk()
            ->assertJsonPath('messages.1.kind', LivecastMessage::GIFT)
            ->assertJsonPath('messages.1.gift_key', 'rose');

        $this->withToken($hostToken)->postJson("/api/v1/site/livecast/{$stream->id}/end")->assertOk()
            ->assertJsonPath('broadcast.status', Livecast::ENDED);
        $this->assertSame(Livecast::ENDED, $stream->fresh()->status);
    }

    public function test_one_live_stream_per_host(): void
    {
        $host = User::factory()->create();
        $token = $this->appToken($host);
        $this->withToken($token)->postJson('/api/v1/site/livecast', ['title' => 'First'])->assertCreated();
        $this->withToken($token)->postJson('/api/v1/site/livecast', ['title' => 'Second'])->assertStatus(422);
        $this->assertSame(1, Livecast::query()->where('status', Livecast::LIVE)->count());
    }

    public function test_pulse_reports_live_streams_and_viewers(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();

        $this->actingAs($host)->getJson(route('livecast.pulse'))
            ->assertOk()
            ->assertJsonPath('live', 0)
            ->assertJsonPath('viewers', 0);

        $this->withToken($this->appToken($host))->postJson('/api/v1/site/livecast', ['title' => 'Boss'])->assertCreated();
        $stream = Livecast::query()->sole();
        $this->actingAs($viewer)->postJson(route('livecast.join', $stream))->assertOk();

        $pulse = $this->actingAs($host)->getJson(route('livecast.pulse'))
            ->assertOk()
            ->assertJsonPath('live', 1)
            ->json();
        $this->assertGreaterThanOrEqual(1, (int) $pulse['viewers']);
    }

    public function test_catalog_exposes_donatik_donatello_presets(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson(route('livecast.index'))
            ->assertOk()
            ->assertJsonPath('go_live_on_app', true)
            ->assertJsonPath('donation_presets.0.key', 'donatik')
            ->assertJsonPath('donation_presets.1.key', 'donatello')
            ->assertJsonPath('donation_presets.2.key', 'monobank')
            ->assertJsonCount(3, 'donation_presets');
    }

    public function test_integrations_save_and_donatello_webhook_posts_to_live_chat(): void
    {
        $host = User::factory()->create();

        $this->actingAs($host)->putJson(route('livecast.integrations.update', 'donatello'), [
            'page_url' => 'https://donatello.to/raidboss',
            'api_token' => 'tok-donatello-test',
            'webhook_key' => 'secret-webhook-key',
        ])->assertOk()
            ->assertJsonPath('integrations.1.provider', 'donatello')
            ->assertJsonPath('integrations.1.has_api_token', true)
            ->assertJsonPath('integrations.1.has_webhook_key', true)
            ->assertJsonPath('integrations.1.page_url', 'https://donatello.to/raidboss');

        $integration = LivecastIntegration::query()->where('user_id', $host->id)->where('provider', 'donatello')->sole();
        $this->assertNotEmpty($integration->hook_id);
        $this->assertStringContainsString('/api/webhooks/livecast/donatello/'.$integration->hook_id, $integration->webhookUrl());

        // Без явного URL — підставляється page_url з інтеграції.
        $this->withToken($this->appToken($host))->postJson('/api/v1/site/livecast', ['title' => 'Boss raid'])
            ->assertCreated()
            ->assertJsonPath('broadcast.donations.0.provider', 'donatello')
            ->assertJsonPath('broadcast.donations.0.url', 'https://donatello.to/raidboss');

        $this->postJson('/api/webhooks/livecast/donatello/'.$integration->hook_id, [
            'pubId' => 'pub-1',
            'clientName' => 'Oleh',
            'message' => 'GG',
            'amount' => 50,
            'currency' => 'UAH',
        ], ['X-Key' => 'secret-webhook-key'])
            ->assertOk()
            ->assertJsonPath('message', 'Donation processed')
            ->assertJsonPath('posted', true);

        $msg = LivecastMessage::query()->where('kind', LivecastMessage::DONATION)->sole();
        $this->assertSame('donatello', $msg->meta['provider'] ?? null);
        $this->assertSame('pub-1', $msg->meta['external_id'] ?? null);
        $this->assertStringContainsString('Oleh', $msg->body);
        $this->assertStringContainsString('50', $msg->body);

        // Повтор того самого pubId — без дубля.
        $this->postJson('/api/webhooks/livecast/donatello/'.$integration->hook_id, [
            'pubId' => 'pub-1',
            'clientName' => 'Oleh',
            'amount' => 50,
            'currency' => 'UAH',
        ], ['X-Key' => 'secret-webhook-key'])
            ->assertOk()
            ->assertJsonPath('posted', false);
        $this->assertSame(1, LivecastMessage::query()->where('kind', LivecastMessage::DONATION)->count());

        $this->postJson('/api/webhooks/livecast/donatello/'.$integration->hook_id, [
            'pubId' => 'pub-2',
            'amount' => 10,
        ], ['X-Key' => 'wrong'])
            ->assertUnauthorized();
    }

    public function test_donatik_webhook_and_token_test(): void
    {
        $host = User::factory()->create();
        Http::fake([
            'voice.gamecon.test/twirp/*' => Http::response([], 200),
            'api.donatik.ua/donations' => Http::response(['data' => []], 200),
        ]);

        $this->actingAs($host)->putJson(route('livecast.integrations.update', 'donatik'), [
            'page_url' => 'https://donatik.ua/streamer',
            'api_token' => 'tok-donatik',
            'webhook_key' => 'donatik-secret',
        ])->assertOk();

        $this->actingAs($host)->postJson(route('livecast.integrations.test', 'donatik'))
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('provider', 'donatik');

        $integration = LivecastIntegration::query()->where('provider', 'donatik')->sole();
        $this->withToken($this->appToken($host))->postJson('/api/v1/site/livecast', ['title' => 'Farm'])->assertCreated();

        $this->postJson('/api/webhooks/livecast/donatik/'.$integration->hook_id, [
            'id' => 'd-9',
            'name' => 'Anna',
            'sum' => 100,
            'curr' => 'UAH',
            'comment' => 'Nice',
        ], ['Authorization' => 'Bearer donatik-secret'])
            ->assertOk()
            ->assertJsonPath('posted', true);

        $this->assertSame(1, LivecastMessage::query()->where('kind', LivecastMessage::DONATION)->count());
        $this->assertStringContainsString('Anna', LivecastMessage::query()->sole()->body);
    }

    public function test_api_poll_brings_new_donations_into_live_chat_once(): void
    {
        $host = User::factory()->create();
        $stream = Livecast::query()->create(['host_id' => $host->id, 'title' => 'Рейд', 'status' => Livecast::LIVE, 'started_at' => now()->subMinutes(10), 'viewers' => 0, 'peak_viewers' => 0]);
        LivecastIntegration::query()->create(['user_id' => $host->id, 'provider' => 'donatello', 'api_token' => 'tok', 'hook_id' => 'h1']);
        LivecastIntegration::query()->create(['user_id' => $host->id, 'provider' => 'donatik', 'api_token' => 'tok2', 'hook_id' => 'h2']);
        Http::fake([
            'donatello.to/api/v1/donates*' => Http::response(['success' => true, 'content' => [
                ['pubId' => 'old', 'clientName' => 'Давній', 'amount' => 50, 'currency' => 'UAH', 'createdAt' => now()->subHour()->toIso8601String()],
                ['pubId' => 'new', 'clientName' => 'Оля', 'message' => 'На рейд!', 'amount' => 100, 'currency' => 'UAH', 'createdAt' => now()->subMinute()->toIso8601String()],
            ]]),
            'api.donatik.ua/donations*' => Http::response(['data' => [
                ['id' => 'd-1', 'name' => 'Ігор', 'amount' => 25, 'currency' => 'UAH', 'createdAt' => now()->subMinutes(2)->toIso8601String()],
            ]]),
        ]);

        $this->artisan('livecast:poll-donations')->assertSuccessful();
        $this->artisan('livecast:poll-donations')->assertSuccessful();

        $bodies = LivecastMessage::query()->where('livecast_id', $stream->id)->where('kind', LivecastMessage::DONATION)->pluck('body')->all();
        $this->assertCount(2, $bodies);
        $this->assertTrue(collect($bodies)->contains(fn ($b) => str_contains($b, 'Оля') && str_contains($b, 'На рейд!')));
        $this->assertTrue(collect($bodies)->contains(fn ($b) => str_contains($b, 'Ігор')));
        $this->assertFalse(collect($bodies)->contains(fn ($b) => str_contains($b, 'Давній')));
    }

    public function test_viewers_like_a_stream_once_and_can_unlike(): void
    {
        [$host, $a, $b] = User::factory()->count(3)->create();
        $stream = Livecast::query()->create(['host_id' => $host->id, 'title' => 'Рейд', 'status' => Livecast::LIVE, 'started_at' => now(), 'viewers' => 0, 'peak_viewers' => 0]);

        $this->actingAs($a)->postJson("/livecast/{$stream->id}/like")->assertOk()->assertJsonPath('liked', true)->assertJsonPath('likes', 1);
        $this->withToken($this->appToken($b))->postJson("/api/v1/site/livecast/{$stream->id}/like")->assertOk()->assertJsonPath('likes', 2);
        $this->actingAs($a)->postJson("/livecast/{$stream->id}/like")->assertJsonPath('liked', false)->assertJsonPath('likes', 1);

        $this->actingAs($b)->getJson("/livecast/{$stream->id}/state")->assertJsonPath('broadcast.likes', 1)->assertJsonPath('me.liked', true);
        $this->actingAs($a)->getJson("/livecast/{$stream->id}/state")->assertJsonPath('me.liked', false);
    }

    public function test_monobank_jar_link_is_accepted_for_stream(): void
    {
        $host = User::factory()->create();
        $stream = Livecast::query()->create(['host_id' => $host->id, 'title' => 'Збір', 'status' => Livecast::LIVE, 'started_at' => now(), 'viewers' => 0, 'peak_viewers' => 0]);
        $this->actingAs($host)->putJson("/livecast/{$stream->id}/donations", ['donations' => [
            ['provider' => 'monobank', 'url' => 'https://send.monobank.ua/jar/abc123'],
            ['provider' => 'monobank', 'url' => 'https://evil.example.com/jar'],
        ]])->assertOk();
        $this->actingAs($host)->getJson("/livecast/{$stream->id}/state")
            ->assertJsonPath('broadcast.donations.0.name', 'Банка monobank')
            ->assertJsonCount(1, 'broadcast.donations');
    }

    public function test_feed_widgets_include_livecast_streams(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $this->withToken($this->appToken($host))->postJson('/api/v1/site/livecast', [
            'title' => 'Widget stream',
            'category' => 'FPS',
        ])->assertCreated();

        $this->actingAs($viewer)->getJson('/feed/widgets')
            ->assertOk()
            ->assertJsonPath('livecast.live', 1)
            ->assertJsonPath('livecast.streams.0.title', 'Widget stream')
            ->assertJsonPath('livecast.streams.0.category', 'FPS');
    }
}
