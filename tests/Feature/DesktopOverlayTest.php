<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** №261: сторінка оверлею тривог для застосунку Windows — лише там, де розділ тривог доступний. */
class DesktopOverlayTest extends TestCase
{
    use RefreshDatabase;

    public function test_overlay_respects_plugin_country_and_login(): void
    {
        $user = User::factory()->create(['country' => 'UA']);

        // Плагін тривог вимкнено — оверлей нічого не показує й не опитує.
        $this->actingAs($user)->get('/desktop/overlay')->assertOk()->assertViewHas('available', false);

        app(Plugins::class)->set('air_alerts', true);
        $this->actingAs($user)->get('/desktop/overlay')->assertOk()->assertViewHas('available', true)
            ->assertSee('alert_changed', false)->assertHeader('Cache-Control', 'no-store, private');

        // Не з України — розділу немає, оверлею теж.
        $foreign = User::factory()->create(['country' => 'PL', 'locale' => 'en']);
        $this->actingAs($foreign)->get('/desktop/overlay')->assertViewHas('available', false);
    }

    public function test_guest_gets_empty_overlay_instead_of_login_redirect(): void
    {
        app(Plugins::class)->set('air_alerts', true);
        $this->get('/desktop/overlay')->assertOk()->assertViewHas('available', false)->assertViewHas('guest', true);
    }
}
