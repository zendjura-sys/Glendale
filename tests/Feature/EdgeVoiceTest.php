<?php

namespace Tests\Feature;

use App\Services\Edge\EdgeNode;
use App\Services\Voice\LiveKit;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** GameCast і кімнати через Edge-вузол: ключі парою й запасний сервер, коли LiveKit вузла не працює. */
class EdgeVoiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $settings = app(SiteSettings::class);
        $settings->put([
            'livekit_url' => 'wss://voice.gamecon.test',
            'livekit_api_key' => 'MAINKEY',
            'edge_host' => 'https://edge.gamecon.test',
            'edge_voice' => EdgeNode::EDGE,
        ]);
        $settings->putSecret('livekit_api_secret', 'main-secret');
    }

    public function test_keys_never_mix_edge_and_main(): void
    {
        // Ключ вузла вписано, а секрет — ні: раніше токен мав ключ вузла й секрет основного.
        app(SiteSettings::class)->put(['edge_livekit_api_key' => 'EDGEKEY']);
        $livekit = app(LiveKit::class);
        $this->assertSame('wss://edge.gamecon.test', $livekit->url());
        $this->assertSame(['MAINKEY', 'main-secret'], [$livekit->key(), $livekit->secret()]);

        app(SiteSettings::class)->putSecret('edge_livekit_api_secret', 'edge-secret');
        $this->assertSame(['EDGEKEY', 'edge-secret'], [$livekit->key(), $livekit->secret()]);
    }

    public function test_voice_falls_back_to_main_when_edge_livekit_rejects_keys(): void
    {
        Http::fake([
            'edge.gamecon.test/edge-health' => Http::response("ok\n"),
            // Двічі ключі не ті, потім узел ожив.
            'edge.gamecon.test/twirp/*' => Http::sequence()->push('unauthorized', 401)->push('unauthorized', 401)->push(['rooms' => []]),
        ]);
        $edge = app(EdgeNode::class);
        $this->assertSame('voice-auth', $edge->probe());
        $this->assertTrue($edge->voice(), 'одна невдача — ще не перемикаємо');
        $edge->probe();
        $this->assertFalse($edge->voice());
        $this->assertSame('wss://voice.gamecon.test', app(LiveKit::class)->url());

        // Вузол ожив — голос знову через нього.
        $this->assertSame('ok', $edge->probe());
        $this->assertTrue($edge->voice());
    }
}
