<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** №285: сторінка журналу змін відкрита гостям і людям. */
class ChangelogTest extends TestCase
{
    use RefreshDatabase;

    public function test_changelog_page_is_public(): void
    {
        $this->get('/changelog')->assertOk()->assertInertia(fn (Assert $page) => $page->component('changelog'));
        $this->actingAs(User::factory()->create())->get('/changelog')->assertOk();
    }
}
