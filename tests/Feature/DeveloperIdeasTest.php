<?php

namespace Tests\Feature;

use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** №304: ідеї інтеграцій — без ідей для вимкнених розділів. */
class DeveloperIdeasTest extends TestCase
{
    use RefreshDatabase;

    public function test_ideas_page_lists_only_enabled_sections(): void
    {
        $this->withoutVite();
        $this->get('/developers/ideas')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('developers/ideas')
            ->where('enabled', fn ($enabled) => collect($enabled)->contains('families')));

        app(ModuleManager::class)->set('families', false);
        $this->get('/developers/ideas')->assertInertia(fn (Assert $page) => $page
            ->where('enabled', fn ($enabled) => ! collect($enabled)->contains('families')));
    }
}
