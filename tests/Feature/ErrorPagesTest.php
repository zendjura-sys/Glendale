<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Власні сторінки помилок і карта сайту / robots для пошуковиків. */
class ErrorPagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['app.debug' => false]);
    }

    public function test_missing_page_shows_the_site_404(): void
    {
        $this->get('/no/such/page/here')->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 404));
    }

    public function test_forbidden_page_shows_the_site_403(): void
    {
        $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 403));
    }

    public function test_api_errors_stay_json(): void
    {
        $this->getJson('/api/v1/nope')->assertNotFound()->assertJsonStructure(['message']);
    }

    public function test_sitemap_lists_public_pages_and_open_profiles_only(): void
    {
        $open = User::factory()->create(['username' => 'openplayer', 'is_private' => false]);
        User::factory()->create(['username' => 'hiddenplayer', 'is_private' => true]);
        User::factory()->create(['username' => 'bannedplayer', 'banned_at' => now()]);

        $xml = $this->get('/sitemap.xml')->assertOk()->assertHeader('Content-Type', 'application/xml; charset=UTF-8')->getContent();
        $this->assertStringContainsString('<loc>'.url('/contacts').'</loc>', $xml);
        $this->assertStringContainsString('<loc>'.url('/'.$open->username).'</loc>', $xml);
        $this->assertStringNotContainsString('hiddenplayer', $xml);
        $this->assertStringNotContainsString('bannedplayer', $xml);
        $this->assertNotFalse(simplexml_load_string($xml));
    }
}
