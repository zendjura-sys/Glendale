<?php

namespace Tests\Feature;

use App\Support\MobileRelease;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MobileReleaseTest extends TestCase
{
    public function test_without_token_uses_public_fallback(): void
    {
        config(['services.github.releases_token' => null]);

        $src = MobileRelease::source('build.txt');

        $this->assertSame(MobileRelease::PUBLIC_FALLBACK.'build.txt', $src['url']);
        $this->assertSame([], $src['headers']);
    }

    public function test_with_token_downloads_private_asset_via_api(): void
    {
        config(['services.github.releases_token' => 'test-token']);
        Http::fake([
            'api.github.com/repos/zendjura-sys/Glendale/releases/tags/mobile-latest' => Http::response([
                'assets' => [['name' => 'build.txt', 'url' => 'https://api.github.com/repos/zendjura-sys/Glendale/releases/assets/7']],
            ]),
            'api.github.com/repos/zendjura-sys/Glendale/releases/assets/7' => Http::response('61'),
        ]);

        $this->assertSame('61', MobileRelease::fetch('build.txt'));
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/assets/7')
            && $r->hasHeader('Authorization', 'Bearer test-token')
            && $r->hasHeader('Accept', 'application/octet-stream'));
    }

    public function test_falls_back_when_private_release_missing(): void
    {
        config(['services.github.releases_token' => 'test-token']);
        Http::fake(['api.github.com/*' => Http::response(['message' => 'Not Found'], 404)]);

        $this->assertSame(MobileRelease::PUBLIC_FALLBACK.'monsory-connect.apk', MobileRelease::source('monsory-connect.apk')['url']);
    }
}
