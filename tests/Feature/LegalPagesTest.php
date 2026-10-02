<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LegalPagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    public function test_policy_terms_and_child_safety_are_public(): void
    {
        $this->get(route('legal.policy'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('legal/show')
                ->where('kind', 'policy')
                ->where('contact', 'safety@gamecon.online')
                ->has('sections'));

        $this->get(route('legal.terms'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('legal/show')
                ->where('kind', 'terms'));

        $this->get(route('legal.safety'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('legal/show')
                ->where('kind', 'safety')
                ->where('summary', fn (string $summary) => str_contains($summary, 'child sexual abuse')));
    }

    public function test_reserved_legal_paths_do_not_open_a_profile(): void
    {
        User::factory()->create(['username' => 'policy']);

        $this->get('/policy')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('legal/show')->where('kind', 'policy'));

        $this->get('/terms')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('legal/show')->where('kind', 'terms'));

        $this->get('/child-safety')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('legal/show')->where('kind', 'safety'));
    }
}
