<?php

namespace Tests\Feature;

use App\Models\Livecast;
use App\Models\User;
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

    public function test_host_starts_joins_with_video_sources_chats_and_ends(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();

        $this->actingAs($host)->postJson(route('livecast.store'), ['title' => 'Raid boss', 'category' => 'MMO'])
            ->assertCreated()
            ->assertJsonPath('broadcast.title', 'Raid boss')
            ->assertJsonPath('broadcast.status', Livecast::LIVE);

        $stream = Livecast::query()->sole();

        $token = $this->actingAs($host)->postJson(route('livecast.join', $stream))
            ->assertOk()
            ->json('token');
        $parts = explode('.', (string) $token);
        $payload = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/').str_repeat('=', (4 - strlen($parts[1]) % 4) % 4)), true);
        $this->assertEqualsCanonicalizing(
            ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
            $payload['video']['canPublishSources'] ?? [],
        );

        $viewerToken = $this->actingAs($viewer)->postJson(route('livecast.join', $stream))->assertOk()->json('token');
        $viewerParts = explode('.', (string) $viewerToken);
        $viewerPayload = json_decode((string) base64_decode(strtr($viewerParts[1], '-_', '+/').str_repeat('=', (4 - strlen($viewerParts[1]) % 4) % 4)), true);
        $this->assertFalse($viewerPayload['video']['canPublish'] ?? true);

        $this->actingAs($viewer)->postJson(route('livecast.messages', $stream), ['body' => 'GG'])
            ->assertOk()
            ->assertJsonPath('messages.0.body', 'GG');

        $this->actingAs($host)->postJson(route('livecast.end', $stream))->assertOk()
            ->assertJsonPath('broadcast.status', Livecast::ENDED);
        $this->assertSame(Livecast::ENDED, $stream->fresh()->status);
    }

    public function test_one_live_stream_per_host(): void
    {
        $host = User::factory()->create();
        $this->actingAs($host)->postJson(route('livecast.store'), ['title' => 'First'])->assertCreated();
        $this->actingAs($host)->postJson(route('livecast.store'), ['title' => 'Second'])->assertStatus(422);
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

        $this->actingAs($host)->postJson(route('livecast.store'), ['title' => 'Boss'])->assertCreated();
        $stream = Livecast::query()->sole();
        $this->actingAs($viewer)->postJson(route('livecast.join', $stream))->assertOk();

        $pulse = $this->actingAs($host)->getJson(route('livecast.pulse'))
            ->assertOk()
            ->assertJsonPath('live', 1)
            ->json();
        $this->assertGreaterThanOrEqual(1, (int) $pulse['viewers']);
    }
}
