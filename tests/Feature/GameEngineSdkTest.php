<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Developer\CmsPlugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

/** №309: SDK для ігрових рушіїв (Unity, Unreal, Godot) і Flutter-ігор — у каталозі й архівах. */
class GameEngineSdkTest extends TestCase
{
    use RefreshDatabase;

    public function test_engines_are_listed_and_packages_contain_the_sdk(): void
    {
        $this->withoutVite();
        $this->get('/developers/plugins')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('plugins', fn ($plugins) => collect($plugins)->where('kind', 'engine')->pluck('key')->sort()->values()->all() === ['godot', 'unity', 'unreal']));
        $this->get('/developers/plugins/unity')->assertOk();

        $expect = [
            'unity' => ['com.gamecon.sdk/Runtime/GameConClient.cs', 'com.gamecon.sdk/Runtime/GameConHud.cs', 'com.gamecon.sdk/package.json'],
            'unreal' => ['GameConSDK/GameConSDK.uplugin', 'GameConSDK/Source/GameConSDK/Private/GameConSubsystem.cpp'],
            'godot' => ['addons/gamecon/plugin.cfg', 'addons/gamecon/gamecon.gd', 'addons/gamecon/hud.gd'],
            'flutter' => ['gamecon_sdk/gamecon_sdk.dart', 'gamecon_sdk/gc_overlay_widget.dart', 'gamecon_auth/gamecon_auth.dart'],
        ];
        foreach ($expect as $key => $files) {
            $zip = new ZipArchive;
            $this->assertTrue($zip->open(CmsPlugins::archive($key)) === true);
            $names = array_map(fn (int $i) => (string) $zip->getNameIndex($i), range(0, $zip->numFiles - 1));
            foreach ($files as $file) {
                $this->assertTrue(collect($names)->contains(fn (string $n) => str_ends_with($n, $file)), "{$key}: немає {$file}");
            }
            // Усі пакети ходять у той самий вхід кодом пристрою.
            $zip->close();
        }

        $this->actingAs(User::factory()->create())->get('/developers/plugins/godot/download')->assertOk();
    }
}
