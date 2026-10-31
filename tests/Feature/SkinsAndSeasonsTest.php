<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Backgrounds;
use App\Support\Seasons;
use App\Support\Settings\SiteSettings;
use App\Support\Skins;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Стилі інтерфейсу (flat / Hero / Material / Flex), сезонні прикраси й фірмовий фон з адмінки. */
class SkinsAndSeasonsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    /** @param  array<string, mixed>  $data */
    private function appearance(array $data): array
    {
        return [...['palette' => 'ocean', 'quiet_enabled' => false, 'quiet_from' => '23:00', 'quiet_to' => '08:00', 'looking_for_group' => false], ...$data];
    }

    public function test_skin_is_saved_shared_and_validated(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('auth.user.skin', 'gamecon'));

        $this->actingAs($user)->put('/settings/appearance', $this->appearance(['skin' => 'material']))->assertSessionHasNoErrors();
        $this->assertSame('material', $user->refresh()->pref('skin'));
        $this->actingAs($user)->get('/feed')
            ->assertSee('data-skin="material"', false)
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.skin', 'material'));

        $this->actingAs($user)->put('/settings/appearance', $this->appearance(['skin' => '3d']))->assertSessionHasErrors('skin');
        $this->assertSame('material', $user->refresh()->pref('skin'));
    }

    public function test_theme_is_saved_shared_and_set_on_the_page(): void
    {
        $user = User::factory()->create();
        // Типово — як на пристрої: сервер ставить темну, скрипт у <head> уточнює до першого кадру.
        $this->actingAs($user)->get('/feed')
            ->assertSee('data-theme="dark"', false)
            ->assertSee('data-theme-pref="system"', false)
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.theme', 'system'));

        $this->actingAs($user)->put('/settings/appearance', $this->appearance(['theme' => 'light']))->assertSessionHasNoErrors();
        $this->assertSame('light', $user->refresh()->pref('theme'));
        $this->actingAs($user)->get('/feed')
            ->assertSee('data-theme="light"', false)
            ->assertSee('class="light"', false)
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.theme', 'light'));

        // Швидкий перемикач у меню змінює лише тему.
        $this->actingAs($user)->put('/settings/theme', ['theme' => 'dark'])->assertRedirect();
        $this->assertSame('dark', $user->refresh()->pref('theme'));
        $this->assertSame('ocean', $user->pref('palette'));
        $this->actingAs($user)->put('/settings/theme', ['theme' => 'sepia'])->assertSessionHasErrors('theme');

        // Стилі без світлої теми лишаються темними навіть із вибором «світла».
        $user->mergePref(['theme' => 'light', 'skin' => 'material']);
        $this->actingAs($user)->get('/feed')->assertSee('data-theme="dark"', false);
        $this->assertSame('dark', Skins::initialTheme($user->refresh()));
    }

    public function test_seasons_follow_the_calendar(): void
    {
        $at = fn (string $date) => Seasons::byDate(CarbonImmutable::parse($date, 'Europe/Kyiv'));

        $this->assertSame('newyear', $at('2026-12-31'));
        $this->assertSame('newyear', $at('2027-01-07'));
        $this->assertSame('valentine', $at('2027-02-14'));
        $this->assertSame('easter', $at('2026-04-12'));
        $this->assertSame('easter', $at('2026-04-05'));
        $this->assertNull($at('2026-04-17'));
        $this->assertSame('independence', $at('2026-08-24'));
        $this->assertSame('halloween', $at('2026-10-31'));
        $this->assertNull($at('2026-06-15'));

        $this->assertSame('2025-04-20', Seasons::orthodoxEaster(2025)->toDateString());
        $this->assertSame('2026-04-12', Seasons::orthodoxEaster(2026)->toDateString());
        $this->assertSame('2027-05-02', Seasons::orthodoxEaster(2027)->toDateString());
    }

    public function test_admin_forces_or_disables_and_member_can_opt_out(): void
    {
        $admin = User::factory()->admin()->create();
        $member = User::factory()->create();

        $this->actingAs($member)->post('/admin/design/seasonal', ['seasonal' => 'off'])->assertForbidden();
        $this->actingAs($admin)->post('/admin/design/seasonal', ['seasonal' => 'snow'])->assertSessionHasErrors('seasonal');

        $this->actingAs($admin)->post('/admin/design/seasonal', ['seasonal' => 'newyear'])->assertSessionHasNoErrors();
        $this->assertSame('newyear', app(SiteSettings::class)->get(Seasons::SETTING));
        $this->actingAs($member)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('season', 'newyear'));
        $this->actingAs($admin)->get('/admin/design')->assertInertia(fn (Assert $page) => $page->where('seasonal', 'newyear')->has('seasons', 5));

        $this->actingAs($member)->put('/settings/appearance', $this->appearance(['seasonal' => false]))->assertSessionHasNoErrors();
        $this->actingAs($member)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('season', null));
        $this->actingAs($member)->get('/settings/appearance')->assertInertia(fn (Assert $page) => $page->where('seasonal', false));

        $this->actingAs($admin)->post('/admin/design/seasonal', ['seasonal' => 'off']);
        $this->actingAs($admin)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('season', null));
    }

    public function test_admin_uploads_desktop_and_mobile_background(): void
    {
        Storage::fake('public');
        $admin = User::factory()->admin()->create();
        $member = User::factory()->create();

        $this->actingAs($member)->post('/admin/design/background', ['desktop' => UploadedFile::fake()->image('bg.jpg', 1920, 1080)])->assertForbidden();
        $this->actingAs($admin)->post('/admin/design/background', ['desktop' => UploadedFile::fake()->create('bg.pdf', 10, 'application/pdf')])->assertSessionHasErrors('desktop');
        // Без картинки «Фірмовий» не можна обрати.
        $this->actingAs($member)->put('/settings/appearance', $this->appearance(['background' => 'custom']))->assertSessionHasErrors('background');

        $this->actingAs($admin)->post('/admin/design/background', [
            'desktop' => UploadedFile::fake()->image('bg.jpg', 1920, 1080),
            'mobile' => UploadedFile::fake()->image('bg-m.png', 1080, 2340),
        ])->assertSessionHasNoErrors();
        $stored = Backgrounds::stored();
        Storage::disk('public')->assertExists([$stored['desktop'], $stored['mobile']]);
        $this->assertFalse($stored['default']);

        // Учасник обирає «Фірмовий» сам.
        $this->actingAs($member)->put('/settings/appearance', $this->appearance(['background' => 'custom']))->assertSessionHasNoErrors();
        $this->actingAs($member)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.background.preset', 'custom')
            ->where('siteBackground.mobile', Storage::disk('public')->url($stored['mobile'])));

        // Типовий фон для всіх: той, хто не обирав, бачить фірмовий.
        $this->actingAs($admin)->post('/admin/design/background', ['default' => true])->assertSessionHasNoErrors();
        $this->actingAs(User::factory()->create())->get('/feed')->assertInertia(fn (Assert $page) => $page->where('auth.user.background.preset', 'custom'));

        // Нова картинка замінює стару; видалення обох вимикає фірмовий фон.
        $this->actingAs($admin)->post('/admin/design/background', ['desktop' => UploadedFile::fake()->image('new.jpg', 2560, 1440)]);
        Storage::disk('public')->assertMissing($stored['desktop']);
        $this->actingAs($admin)->delete('/admin/design/background/desktop')->assertRedirect();
        $this->actingAs($admin)->delete('/admin/design/background/mobile')->assertRedirect();
        $this->assertNull(Backgrounds::image());
        $this->actingAs($member)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('auth.user.background.preset', Backgrounds::DEFAULT)->where('siteBackground', null));
    }
}
