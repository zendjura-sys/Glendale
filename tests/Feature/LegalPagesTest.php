<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegalPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_terms_and_privacy_are_public(): void
    {
        $this->withoutVite();

        $this->get(route('legal.terms'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('legal')->where('document', 'terms'));

        $this->get(route('legal.privacy'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('legal')->where('document', 'privacy'));
    }
}
