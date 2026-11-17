<?php

namespace Tests\Feature;

use App\Models\Livecast;
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
            ->assertJsonCount(2, 'donation_presets');
    }
}
