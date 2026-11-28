<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NotificationsPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_browser_gets_a_page_and_the_bell_gets_json(): void
    {
        $user = User::factory()->create();

        // Посилання «Сповіщення» (палітра команд, «Поки вас не було», розділений екран) відкривають сторінку, а не сирий JSON.
        $this->actingAs($user)->get('/notifications')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('notifications/index'));

        $this->actingAs($user)->getJson('/notifications')->assertOk()
            ->assertJsonStructure(['notifications', 'unread']);
    }
}
