<?php

namespace Tests\Feature;

use App\Models\SiteTheme;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Адмінка → Дизайн: завантаження стилів, перевірка CSS, увімкнення для всіх і попередній перегляд. */
class AdminDesignTest extends TestCase
{
    use RefreshDatabase;

    private const CSS = ":root { --background: #101826; --primary: #22d3a6; }\nhtml { background-color: #101826; }\n";

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->withoutVite();
    }

    private function css(string $content, string $name = 'style.css'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $content);
    }

    public function test_only_admins_open_the_design_tab(): void
    {
        $this->actingAs(User::factory()->create())->get('/admin/design')->assertForbidden();
        $this->actingAs(User::factory()->create())->post('/admin/design', ['name' => 'X', 'file' => $this->css(self::CSS)])->assertForbidden();

        $this->actingAs(User::factory()->admin()->create())->get('/admin/design')
            ->assertInertia(fn (Assert $page) => $page->component('admin/design')->where('themes', [])->where('limits.max_kb', 200));
    }

    public function test_admin_uploads_activates_and_resets_a_style(): void
    {
        $admin = User::factory()->admin()->create();
        $visitor = User::factory()->create();

        $this->actingAs($admin)->post('/admin/design', ['name' => 'Зима 2026', 'author' => 'Студія', 'file' => $this->css(self::CSS)])
            ->assertSessionHasNoErrors();
        $theme = SiteTheme::query()->sole();
        $this->assertSame('zima-2026', $theme->slug);
        $this->assertFalse($theme->is_active);
        Storage::disk('public')->assertExists($theme->path);
        $this->assertSame(self::CSS, Storage::disk('public')->get($theme->path));

        // Не активний — відвідувачі його не бачать, а адміністратор може переглянути.
        $this->actingAs($visitor)->get('/feed')->assertDontSee('data-site-theme', false);
        $this->actingAs($admin)->get('/feed?design_preview='.$theme->id)->assertSee($theme->url(), false);
        $this->actingAs($visitor)->get('/feed?design_preview='.$theme->id)->assertDontSee($theme->url(), false);

        $this->actingAs($admin)->post("/admin/design/{$theme->id}/activate")->assertSessionHasNoErrors();
        $this->actingAs($visitor)->get('/feed')->assertSee($theme->url(), false);
        $this->actingAs($admin)->get('/feed?design_preview=default')->assertDontSee('data-site-theme', false);

        $this->actingAs($admin)->post('/admin/design/reset')->assertSessionHasNoErrors();
        $this->assertFalse($theme->fresh()->is_active);
        $this->actingAs($visitor)->get('/feed')->assertDontSee('data-site-theme', false);
    }

    public function test_only_one_style_is_active_and_a_new_version_replaces_the_file(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->post('/admin/design', ['name' => 'Перший', 'file' => $this->css(self::CSS), 'activate' => true]);
        $this->actingAs($admin)->post('/admin/design', ['name' => 'Другий', 'file' => $this->css(':root { --primary: #f04fd8; }'), 'activate' => true]);

        [$first, $second] = SiteTheme::query()->orderBy('id')->get()->all();
        $this->assertFalse($first->is_active);
        $this->assertTrue($second->is_active);

        $oldPath = $second->path;
        $this->actingAs($admin)->post("/admin/design/{$second->id}", ['name' => 'Другий', 'description' => 'Яскравіший', 'file' => $this->css(':root { --primary: #ff7a59; }')])
            ->assertSessionHasNoErrors();
        $second->refresh();
        $this->assertSame(2, $second->version);
        $this->assertSame('Яскравіший', $second->description);
        $this->assertNotSame($oldPath, $second->path);
        Storage::disk('public')->assertMissing($oldPath);
        $this->actingAs(User::factory()->create())->get('/feed')->assertSee($second->url(), false);

        $this->actingAs($admin)->delete("/admin/design/{$second->id}")->assertSessionHasNoErrors();
        Storage::disk('public')->assertMissing($second->path);
        $this->actingAs(User::factory()->create())->get('/feed')->assertDontSee('data-site-theme', false);
    }

    public function test_unsafe_css_is_rejected(): void
    {
        $admin = User::factory()->admin()->create();
        $bad = [
            '@import url("https://evil.example/x.css");',
            'body { background: url(https://tracker.example/pixel.png); }',
            'body { background: url(//tracker.example/pixel.png); }',
            '</style><script>alert(1)</script>',
            '@\\69mport "x.css";',
            'body { background: image-set("https://x.example/a.png" 1x); }',
            'body { width: expression(alert(1)); }',
            '   ',
        ];
        foreach ($bad as $css) {
            $this->actingAs($admin)->post('/admin/design', ['name' => 'Поганий', 'file' => $this->css($css)])->assertSessionHasErrors('file');
        }
        $this->actingAs($admin)->post('/admin/design', ['name' => 'Не CSS', 'file' => UploadedFile::fake()->image('a.png')])->assertSessionHasErrors('file');
        $this->assertSame(0, SiteTheme::query()->count());

        // Картинки data: і шляхи цього сайту дозволені.
        $this->actingAs($admin)->post('/admin/design', ['name' => 'Фон', 'file' => $this->css('body { background: url("/storage/bg.webp"), url(data:image/png;base64,iVBORw0KGgo=); }')])
            ->assertSessionHasNoErrors();
        $this->assertSame(1, SiteTheme::query()->count());
    }

    public function test_template_downloads_with_theme_variables(): void
    {
        $response = $this->actingAs(User::factory()->admin()->create())->get('/admin/design/template');
        $response->assertOk()->assertDownload('gamecon-style-template.css');
        $this->assertStringContainsString('--primary', (string) file_get_contents($response->baseResponse->getFile()->getPathname()));
    }
}
