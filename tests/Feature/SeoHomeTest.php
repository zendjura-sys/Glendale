<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Головна для пошуковиків: текст і заголовки звичайним HTML, розмітка WebSite + Organization з контактами й соцмережами. */
class SeoHomeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_home_has_crawlable_text_and_organization_markup(): void
    {
        app(SiteSettings::class)->put([
            'legal_email' => 'support@gamecon.online',
            'seo_same_as' => "https://t.me/gamecon\nне посилання\nhttps://www.instagram.com/gamecon",
        ]);

        $html = $this->get(route('home'))->assertOk()->getContent();

        $this->assertStringContainsString('<main class="seo-static"', $html);
        $this->assertSame(1, substr_count($html, '<h1>'));
        $this->assertStringContainsString('<h2>Усе, що ти любиш, в одному місці</h2>', $html);
        $this->assertStringContainsString('href="mailto:support@gamecon.online"', $html);

        preg_match('#<script type="application/ld\+json">\s*(.+?)\s*</script>#s', $html, $m);
        $graph = json_decode($m[1], true)['@graph'];
        $organization = collect($graph)->firstWhere('@type', 'Organization');
        $this->assertSame(['https://t.me/gamecon', 'https://www.instagram.com/gamecon'], $organization['sameAs']);
        $this->assertSame('support@gamecon.online', $organization['contactPoint'][0]['email']);
        $this->assertSame('WebSite', $graph[0]['@type']);
    }

    public function test_static_text_is_only_on_the_home_page(): void
    {
        $this->actingAs(User::factory()->create())->get(route('legal.contacts'))->assertOk()->assertDontSee('class="seo-static"', false);
    }

    public function test_admin_rejects_social_links_without_https(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->from('/admin/settings')->put('/admin/settings', [
            'site_name' => 'GameCon', 'max_post_length' => 5000, 'max_attachments' => 10, 'max_upload_mb' => 20,
            'max_message_file_mb' => 50, 'music_max_track_mb' => 30,
            'seo_same_as' => "https://t.me/gamecon\nhttp://insecure.example",
        ])->assertSessionHasErrors('seo_same_as');
    }
}
