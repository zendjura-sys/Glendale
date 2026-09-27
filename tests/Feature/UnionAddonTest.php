<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\User;
use Database\Seeders\AddonPermissionsSeeder;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * Аддони union.gamecon.online — окрема гілка від "Аддони" (addons.manage):
 * свій тип пакета ('union'), своя адмінка (union.manage), і взаємно
 * замкнені один від одного — union.manage не дає керувати core/module/
 * plugin, addons.manage не бачить і не керує union-пакетами.
 */
class UnionAddonTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        foreach (['union' => ['demo'], 'module' => ['demo']] as $type => $slugs) {
            foreach ($slugs as $slug) {
                $dir = storage_path("app/addons/{$type}/{$slug}");
                if (is_dir($dir)) {
                    File::deleteDirectory($dir);
                }
            }
        }

        parent::tearDown();
    }

    private function unionAdmin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->assignRole('admin');

        return $user;
    }

    private function addonsAdmin(): User
    {
        $this->seed(AddonPermissionsSeeder::class);
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->assignRole('admin');

        return $user;
    }

    private function package(string $type, string $version, string $slug = 'demo'): UploadedFile
    {
        $zipPath = tempnam(sys_get_temp_dir(), 'addon').'.zip';

        $zip = new \ZipArchive();
        $zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        $zip->addFromString('manifest.json', json_encode([
            'type' => $type,
            'slug' => $slug,
            'name' => 'Demo',
            'version' => $version,
        ]));
        $zip->addFromString('README.txt', "version {$version}");
        $zip->close();

        return new UploadedFile($zipPath, "(Union)({$version})Demo.zip", 'application/zip', null, true);
    }

    public function test_a_union_admin_can_upload_a_union_package(): void
    {
        $admin = $this->unionAdmin();

        $response = $this->actingAs($admin)
            ->post(route('admin.union.addons.upload'), ['package' => $this->package('union', '1.0.0')]);

        $response->assertOk()->assertJsonPath('ok', true);
        $this->assertSame(1, Addon::where('type', 'union')->where('slug', 'demo')->count());
    }

    public function test_union_addons_index_lists_only_union_type(): void
    {
        $admin = $this->unionAdmin();
        $this->actingAs($admin)->post(route('admin.union.addons.upload'), ['package' => $this->package('union', '1.0.0')]);

        $this->actingAs($admin)
            ->get(route('admin.union.addons.index'))
            ->assertInertia(fn ($page) => $page->has('addons', 1)->where('addons.0.type', 'union'));
    }

    public function test_an_addons_manage_admin_without_union_manage_cannot_reach_union_addons(): void
    {
        $this->actingAs($this->addonsAdmin())
            ->get(route('admin.union.addons.index'))
            ->assertForbidden();
    }

    public function test_a_union_manage_admin_without_addons_manage_cannot_reach_the_regular_addons_panel(): void
    {
        $this->actingAs($this->unionAdmin())
            ->get(route('admin.addons.index'))
            ->assertForbidden();
    }

    /** Головна ключова гарантія: union-адмінка не може ЧІПАТИ core/module/plugin-пакет за id. */
    public function test_a_union_admin_cannot_activate_a_regular_module_addon_by_id(): void
    {
        $regularAdmin = $this->addonsAdmin();
        $this->actingAs($regularAdmin)
            ->post(route('admin.addons.upload', 'module'), ['package' => $this->package('module', '1.0.0')]);
        $moduleAddon = Addon::where('type', 'module')->where('slug', 'demo')->firstOrFail();

        $unionAdmin = $this->unionAdmin();

        $this->actingAs($unionAdmin)
            ->post(route('admin.union.addons.activate', $moduleAddon))
            ->assertNotFound();

        $this->assertSame('inactive', $moduleAddon->fresh()->status);
    }

    public function test_the_regular_addons_panel_does_not_list_union_packages(): void
    {
        $unionAdmin = $this->unionAdmin();
        $this->actingAs($unionAdmin)->post(route('admin.union.addons.upload'), ['package' => $this->package('union', '1.0.0')]);

        $this->actingAs($this->addonsAdmin())
            ->get(route('admin.addons.index'))
            ->assertInertia(fn ($page) => $page->missing('addons.union'));
    }

    public function test_a_union_admin_can_activate_and_deactivate_their_own_package(): void
    {
        $admin = $this->unionAdmin();
        $this->actingAs($admin)->post(route('admin.union.addons.upload'), ['package' => $this->package('union', '1.0.0')]);
        $addon = Addon::where('type', 'union')->where('slug', 'demo')->firstOrFail();

        $this->actingAs($admin)->post(route('admin.union.addons.activate', $addon))->assertOk();
        $this->assertSame('active', $addon->fresh()->status);

        $this->actingAs($admin)->post(route('admin.union.addons.deactivate', $addon))->assertOk();
        $this->assertSame('inactive', $addon->fresh()->status);
    }
}
