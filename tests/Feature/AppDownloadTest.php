<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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

    public function test_admin_uploads_direct_download_in_chunks(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $admin = User::factory()->admin()->create();
        $id = (string) Str::uuid();
        $body = 'PK'.str_repeat('x', 3000);
        $parts = str_split($body, 1200);
        $send = fn (int $i, string $name = 'GameCon 1.1.110.apk') => $this->actingAs($admin)->postJson('/admin/design/app-files/apk', [
            'upload_id' => $id, 'index' => $i, 'total' => count($parts), 'name' => $name,
            'chunk' => UploadedFile::fake()->createWithContent('blob', $parts[$i]),
        ]);

        $this->actingAs(User::factory()->create())->postJson('/admin/design/app-files/apk', [])->assertForbidden();
        $send(0, 'virus.exe')->assertJsonValidationErrors('name');
        $send(0)->assertOk()->assertJson(['done' => false]);
        $send(1)->assertOk()->assertJson(['done' => false]);
        $send(2)->assertOk()->assertJson(['done' => true, 'file' => ['name' => 'GameCon-1.1.110.apk', 'size' => strlen($body), 'sha256' => hash('sha256', $body)]]);

        Storage::disk('public')->assertExists('downloads/apk/GameCon-1.1.110.apk');
        $this->assertSame([], Storage::disk('local')->directories('app-uploads'));
        // Файл має перевагу над посиланням; на сторінці /app — розмір і контрольна сума.
        $this->assertStringEndsWith('downloads/apk/GameCon-1.1.110.apk', app(SiteSettings::class)->appLinks()['apk'] ?? '');
        $this->get('/app')->assertInertia(fn (Assert $page) => $page
            ->where('files.apk.sha256', hash('sha256', $body))
            ->where('files.apk.size', strlen($body)));

        $this->actingAs($admin)->delete('/admin/design/app-files/apk')->assertRedirect();
        Storage::disk('public')->assertMissing('downloads/apk/GameCon-1.1.110.apk');
        $this->assertArrayNotHasKey('apk', app(SiteSettings::class)->appLinks());
    }

    public function test_apk_upload_rejects_non_zip_file(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $this->actingAs(User::factory()->admin()->create())->postJson('/admin/design/app-files/apk', [
            'upload_id' => (string) Str::uuid(), 'index' => 0, 'total' => 1, 'name' => 'app.apk',
            'chunk' => UploadedFile::fake()->createWithContent('blob', 'not a zip'),
        ])->assertJsonValidationErrors('chunk');
        $this->assertArrayNotHasKey('apk', app(SiteSettings::class)->appLinks());
    }
}
