<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Сторінка застосунку /app і посилання на магазини (Адмінка → Дизайн). */
class AppDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sets_store_links_and_empty_ones_are_hidden(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs(User::factory()->create())->put('/admin/design/app-links', ['google_play' => 'https://play.google.com/x'])->assertForbidden();

        $this->actingAs($admin)->put('/admin/design/app-links', [
            'google_play' => 'https://play.google.com/store/apps/details?id=online.gamecon.app',
            'windows' => 'https://gamecon.online/downloads/GameCon-Setup.exe',
            'linux' => '',
            'app_store' => 'javascript:alert(1)',
        ])->assertSessionHasErrors('app_store');

        $this->actingAs($admin)->put('/admin/design/app-links', [
            'google_play' => 'https://play.google.com/store/apps/details?id=online.gamecon.app',
            'windows' => 'https://gamecon.online/downloads/GameCon-Setup.exe',
            'linux' => '',
        ])->assertSessionHasNoErrors();

        $this->assertSame(['google_play', 'windows'], array_keys(app(SiteSettings::class)->appLinks()));

        // Гості теж бачать сторінку; лише магазини з посиланнями.
        $this->get('/app')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('app/index')
            ->where('links.windows', 'https://gamecon.online/downloads/GameCon-Setup.exe')
            ->missing('links.linux')
            ->missing('links.app_store')
            ->where('site.app_links.google_play', 'https://play.google.com/store/apps/details?id=online.gamecon.app'));
    }

    public function test_old_play_store_link_is_picked_up_until_design_links_are_saved(): void
    {
        app(SiteSettings::class)->put(['play_store_enabled' => true, 'play_store_url' => 'https://play.google.com/old']);
        $this->assertSame('https://play.google.com/old', app(SiteSettings::class)->appLinks()['google_play'] ?? null);

        $this->actingAs(User::factory()->admin()->create())->put('/admin/design/app-links', ['apk' => 'https://gamecon.online/gamecon.apk'])->assertSessionHasNoErrors();
        $this->assertSame(['apk'], array_keys(app(SiteSettings::class)->appLinks()));
    }
}
