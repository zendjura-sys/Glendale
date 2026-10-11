<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Прямі потоки для плеєра застосунку: партнерський метод Kodik video-links з ключем з адмінки. */
class KodikStreamsTest extends TestCase
{
    use RefreshDatabase;

    private function serial(): array
    {
        $movie = Movie::query()->create(['slug' => 'bleach', 'type' => 'anime', 'title' => 'Бліч', 'is_published' => true]);
        $source = new MovieSource(['provider' => 'kodik', 'external_id' => 'serial-1', 'translation' => 'AniLibria', 'link' => 'https://kodik.info/serial/1/hash/720p']);
        $source->movie()->associate($movie)->save();

        return [$movie, $source];
    }

    public function test_app_gets_episode_streams_when_the_key_is_set(): void
    {
        config(['services.kodik.api_url' => 'https://kodik-api.com', 'services.kodik.links_url' => 'https://kodik.biz/api/video-links', 'app.url' => 'https://gamecon.online']);
        $settings = app(SiteSettings::class);
        [$movie, $source] = $this->serial();
        $viewer = User::factory()->create();

        // Без токена Kodik — застосунок лишається на веб-плеєрі.
        $this->actingAs($viewer)->getJson("/cinema/{$movie->slug}/stream?source={$source->id}&season=1&episode=2")
            ->assertOk()->assertJsonPath('available', false);

        // Ключ video-links береться з токена Kodik, який уже задано на сайті для плеєра.
        $settings->putSecret('kodik_token', 'partnerkey1234567890');
        Http::fake([
            'kodik-api.com/search*' => Http::response(['results' => [[
                'id' => 'serial-1', 'link' => '//kodik.info/serial/1/hash/720p',
                'seasons' => ['1' => ['episodes' => ['1' => '//kodik.info/seria/11/a/720p', '2' => '//kodik.info/seria/12/b/720p']]],
            ]]]),
            'kodik.biz/api/video-links*' => Http::response(['links' => [
                '480' => ['src' => '//cloud.kodik-storage.com/x/480.mp4:hls:hls.m3u8'],
                '720' => ['src' => 'https://cloud.kodik-storage.com/x/720.mp4:hls:manifest.m3u8'],
            ]]),
        ]);

        $this->actingAs($viewer)->getJson("/cinema/{$movie->slug}/stream?source={$source->id}&season=1&episode=2")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('qualities.0.label', '480p')
            ->assertJsonPath('qualities.0.url', 'https://cloud.kodik-storage.com/x/480.mp4:hls:manifest.m3u8')
            ->assertJsonPath('qualities.1.label', '720p');

        Http::assertSent(fn (HttpRequest $r) => str_starts_with($r->url(), 'https://kodik.biz/api/video-links')
            && $r['p'] === 'partnerkey1234567890' && $r['link'] === '//kodik.info/seria/12/b/720p' && $r['d'] === 'gamecon.online');

        // Ключ не видно ні в налаштуваннях, ні у відповіді.
        $this->assertArrayNotHasKey('kodik_links_key', $settings->public());
    }
}
