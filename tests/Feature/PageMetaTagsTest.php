<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * <title>/description/og:* у resources/views/app.blade.php — прев'ю
 * посилання (Telegram, Discord тощо) читають лише цю статичну розмітку
 * (SSR не налаштовано, отже без цього фіксу union.gamecon.online завжди
 * показував у прев'ю текст головного сайту).
 */
class PageMetaTagsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_main_domain_shows_its_own_title_and_description(): void
    {
        $response = $this->get('http://localhost/');

        $response->assertOk();
        $response->assertSee('<title inertia>GameConnect</title>', false);
        $response->assertSee(config('family.about')[0], false);
    }

    public function test_the_union_domain_shows_its_own_title_and_description_not_the_main_ones(): void
    {
        Setting::set('union_title', 'Союз Monsory Test', 'design');

        $response = $this->get('http://union.monsory.test/');

        $response->assertOk();
        $response->assertSee('<title inertia>Союз Monsory Test</title>', false);
        $response->assertSee(config('family.union_about')[0], false);
        $response->assertDontSee(config('family.about')[0], false);
    }

    public function test_the_union_domain_sets_open_graph_tags(): void
    {
        $response = $this->get('http://union.monsory.test/');

        $response->assertSee('property="og:title"', false);
        $response->assertSee('property="og:description"', false);
        $response->assertSee('property="og:url" content="http://union.monsory.test"', false);
    }
}
