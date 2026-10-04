<?php

namespace Tests\Feature;

use Tests\TestCase;

class LegalPagesTest extends TestCase
{
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
