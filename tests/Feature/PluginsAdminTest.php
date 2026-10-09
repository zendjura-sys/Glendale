<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PluginsAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_turn_an_integrated_plugin_off_and_back_on(): void
    {
        $this->withoutVite();
        $admin = User::factory()->admin()->create();
        $reader = User::factory()->create();
        $track = Track::query()->create([
            'user_id' => $admin->id,
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'duration' => 180,
            'path' => 'music/test.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
            'lyrics' => 'перший рядок',
        ]);

        $this->actingAs($reader)->get(route('admin.plugins.index'))->assertForbidden();

        $this->actingAs($admin)->get(route('admin.plugins.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/plugins')
                ->where('plugins', fn ($plugins) => collect($plugins)->contains(
                    fn (array $plugin) => $plugin['key'] === 'lyrics' && $plugin['enabled'] === true,
                )));

        $this->actingAs($reader)->getJson(route('tracks.lyrics', $track))
            ->assertOk()
            ->assertJsonPath('lyrics', 'перший рядок');

        $this->actingAs($admin)->patch(route('admin.plugins.update', 'lyrics'), ['enabled' => false])
            ->assertRedirect();
        $this->assertFalse(app(Plugins::class)->on('lyrics'));

        $this->actingAs($reader)->getJson(route('tracks.lyrics', $track))->assertNotFound();
        $this->actingAs($admin)->patch(route('admin.plugins.update', 'missing-plugin'), ['enabled' => false])->assertNotFound();

        $this->actingAs($admin)->patch(route('admin.plugins.update', 'lyrics'), ['enabled' => true])->assertRedirect();
        $this->actingAs($reader)->getJson(route('tracks.lyrics', $track))
            ->assertOk()
            ->assertJsonPath('lyrics', 'перший рядок');
    }
}
