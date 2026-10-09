<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Geo\GeoIp;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GeoBlockTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Замість бази MaxMind/DB-IP: 5.6.7.8 — Росія, решта — Україна.
        $this->app->instance(GeoIp::class, new class(app(SiteSettings::class)) extends GeoIp
        {
            public function country(string $ip): ?string
            {
                return $ip === '5.6.7.8' ? 'RU' : 'UA';
            }

            public function available(): bool
            {
                return true;
            }
        });
    }

    private function fromIp(string $ip): static
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip]);
    }

    public function test_visitors_from_blocked_countries_get_451_on_site_and_api(): void
    {
        $this->fromIp('5.6.7.8')->get('/login')->assertOk();

        app(SiteSettings::class)->put(['geo_blocked' => ['RU']]);
        $this->fromIp('5.6.7.8')->get('/login')->assertStatus(451)->assertSee('GameCon');
        $this->fromIp('5.6.7.8')->getJson('/api/v1/i18n')->assertStatus(451)->assertJsonPath('country', 'RU');
        $this->fromIp('1.2.3.4')->get('/login')->assertOk();
        $this->fromIp('5.6.7.8')->get('/up')->assertOk();

        // Адміністрацію не блокуємо.
        $admin = User::factory()->admin()->create();
        $this->fromIp('5.6.7.8')->actingAs($admin)->get('/admin/geo')->assertOk();
    }

    public function test_admin_chooses_countries_and_cloudflare_header(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs(User::factory()->create())->get('/admin/geo')->assertForbidden();

        $this->actingAs($admin)->put('/admin/geo', ['blocked' => ['XX'], 'trust_cloudflare' => false])->assertSessionHasErrors('blocked.0');
        $this->actingAs($admin)->put('/admin/geo', ['blocked' => ['DE'], 'trust_cloudflare' => true])->assertSessionHasNoErrors();
        $this->assertSame(['DE'], app(SiteSettings::class)->get('geo_blocked'));

        auth()->logout();
        $this->fromIp('1.2.3.4')->get('/login', ['CF-IPCountry' => 'DE'])->assertStatus(451);
        $this->fromIp('1.2.3.4')->get('/login', ['CF-IPCountry' => 'PL'])->assertOk();

        // Без Cloudflare заголовок ігнорується — його можна підробити.
        app(SiteSettings::class)->put(['geo_trust_cloudflare' => false]);
        $this->fromIp('1.2.3.4')->get('/login', ['CF-IPCountry' => 'DE'])->assertOk();
    }

    public function test_database_update_failure_keeps_site_working(): void
    {
        Http::preventStrayRequests();
        Http::fake(['download.db-ip.com/*' => Http::response('not a database', 200)]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post('/admin/geo/refresh')->assertSessionHasNoErrors();
        $this->assertNull(app(SiteSettings::class)->get('geo_db_updated_at'));
        $this->artisan('geoip:update')->assertFailed();

        $this->actingAs($admin)->put('/admin/geo/maxmind', ['account_id' => '123456', 'license_key' => 'abcdefghijklmnop_123'])->assertSessionHasNoErrors();
        $this->assertSame('abcdefghijklmnop_123', app(SiteSettings::class)->secret('maxmind_license_key'));
    }
}
