<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\NetworkModes;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkModesTest extends TestCase
{
    use RefreshDatabase;

    public function test_presets_hide_sections_per_mode_and_keep_core(): void
    {
        $modes = app(NetworkModes::class);
        $user = User::factory()->create();

        // За замовчуванням — «Все включено»: нічого не сховано.
        $this->assertSame('all', $modes->for($user)['id']);

        $user->mergePref(['network_mode' => 'adventure']);
        $visible = $modes->modulesFor($user);
        $this->assertNotContains('games', $visible);
        $this->assertNotContains('servers', $visible);
        $this->assertContains('feed', $visible);
        $this->assertFalse($modes->featuresFor($user)['playing']);

        // «Класика»: звична соцмережа без кіно й ігрових розділів.
        $user->mergePref(['network_mode' => 'classic']);
        $this->assertNotContains('cinema', $modes->modulesFor($user));
        $this->assertNotContains('servers', $modes->modulesFor($user));
        $this->assertContains('music', $modes->modulesFor($user));

        $user->mergePref(['network_mode' => 'gamer']);
        $this->assertNotContains('cinema', $modes->modulesFor($user));
        $this->assertFalse($modes->featuresFor($user)['stories']);

        // Невідомий режим — типовий.
        $user->mergePref(['network_mode' => 'nope']);
        $this->assertSame('all', $modes->for($user)['id']);
    }

    public function test_shared_props_follow_the_mode(): void
    {
        $user = User::factory()->create();
        $user->mergePref(['network_mode' => 'minimal']);

        $this->actingAs($user)->get('/settings/appearance')->assertInertia(fn ($page) => $page
            ->where('auth.user.network_mode', 'minimal')
            ->where('features.stories', false)
            ->where('modules', fn ($modules) => ! collect($modules)->contains('music')));
    }

    public function test_new_member_picks_a_mode_right_after_registration(): void
    {
        $this->post('/register', [
            'first_name' => 'Олена',
            'last_name' => 'Коваль',
            'email' => 'olena@example.com',
            'password' => 'Str0ng-pass-123!',
            'password_confirmation' => 'Str0ng-pass-123!',
        ]);
        $user = User::query()->where('email', 'olena@example.com')->firstOrFail();

        $this->actingAs($user)->get('/feed')->assertRedirect('/start');
        // Реєстрація → номер → режим.
        $this->actingAs($user)->get('/start')->assertRedirect('/start/phone');
        $this->actingAs($user)->post('/start/phone')->assertRedirect('/start/mode');
        $this->actingAs($user)->get('/start')->assertRedirect('/start/mode');
        $this->actingAs($user)->get('/start/mode')->assertOk()
            ->assertInertia(fn ($page) => $page->component('start/mode')->has('modes', 6));

        // Режим без ігор — одразу до стрічки, без вибору ігор і серверів.
        $this->actingAs($user)->post('/start/mode', ['mode' => 'cinema'])->assertRedirect('/feed');
        $this->assertSame('cinema', $user->refresh()->pref('network_mode'));
        $this->assertTrue($user->pref('onboarded'));
    }

    public function test_gamer_mode_continues_to_game_picker_and_mode_can_change_in_settings(): void
    {
        $user = User::factory()->create();
        $user->mergePref(['onboarded' => false]);

        $this->actingAs($user)->post('/start/mode', ['mode' => 'gamer'])->assertRedirect('/start');
        $this->actingAs($user)->post('/start/mode', ['mode' => 'unknown'])->assertSessionHasErrors('mode');

        $this->actingAs($user)->put('/settings/appearance', [
            'palette' => 'aurora',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'looking_for_group' => false,
            'network_mode' => 'classic',
        ])->assertSessionHasNoErrors();
        $this->assertSame('classic', $user->refresh()->pref('network_mode'));
    }

    public function test_admin_configures_modes_in_detail(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $member = User::factory()->create();
        $modes = app(NetworkModes::class);
        $config = $modes->config();

        $this->actingAs($member)->get('/admin/modes')->assertForbidden();
        $this->actingAs($admin)->get('/admin/modes')->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/modes')->has('config.modes', 6));

        // Свій режим: лише стрічка й музика, без опитувань; типовий для новачків.
        $config['modes'][] = [
            'id' => 'music-lovers', 'name' => 'Меломан', 'description' => 'Музика й друзі.', 'icon' => 'music-2',
            'enabled' => true, 'modules' => ['music'], 'plugins_off' => ['polls'], 'features' => ['stories' => true, 'live' => false, 'playing' => false],
        ];
        $config['default'] = 'music-lovers';
        $this->actingAs($admin)->put('/admin/modes', $config)->assertSessionHasNoErrors();

        $newcomer = User::factory()->create();
        $this->assertSame('music-lovers', $modes->for($newcomer)['id']);
        $visible = $modes->modulesFor($newcomer);
        $this->assertContains('music', $visible);
        $this->assertContains('feed', $visible); // ядро лишається завжди
        $this->assertNotContains('games', $visible);
        $this->assertFalse($modes->pluginsFor($newcomer)['polls']);

        // Вимкнений режим не можна зробити типовим.
        $config['modes'][6]['enabled'] = false;
        $this->actingAs($admin)->put('/admin/modes', $config)->assertSessionHasErrors('default');

        $this->actingAs($admin)->post('/admin/modes/reset')->assertRedirect();
        $this->assertSame('all', $modes->config()['default']);
    }

    public function test_modules_added_after_modes_were_saved_are_visible(): void
    {
        // Режими, збережені до появи «Телефону» (без known_modules), — номер однаково видно.
        app(SiteSettings::class)->put([NetworkModes::SETTING => ['default' => 'all', 'modes' => [
            ['id' => 'all', 'name' => 'Все', 'enabled' => true, 'modules' => ['profile', 'feed', 'friends', 'messages']],
        ]]]);
        $this->assertContains('phone', app(NetworkModes::class)->config()['modes'][0]['modules']);

        // Адміністратор прибрав його з режиму й зберіг — лишається прибраним.
        $config = app(NetworkModes::class)->config();
        $config['modes'][0]['modules'] = ['profile', 'feed', 'friends', 'messages'];
        app(NetworkModes::class)->save($config);
        $this->assertNotContains('phone', app(NetworkModes::class)->config()['modes'][0]['modules']);
    }
}
