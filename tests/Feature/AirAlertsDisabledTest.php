<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Мапа тривог — плагін, вимкнений за замовчуванням, поки доробляється. */
class AirAlertsDisabledTest extends TestCase
{
    use RefreshDatabase;

    public function test_air_alerts_plugin_is_off_by_default(): void
    {
        $this->assertFalse(app(Plugins::class)->onForSite('air_alerts'));
        $this->actingAs(User::factory()->create(['country' => 'UA']))->get('/alerts')->assertNotFound();

        app(Plugins::class)->set('air_alerts', true);
        $this->assertTrue(app(Plugins::class)->onForSite('air_alerts'));
    }
}
