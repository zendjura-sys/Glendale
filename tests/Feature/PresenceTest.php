<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Мережевий статус як у Discord: в мережі, неактивний, не турбувати, невидимий. */
class PresenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_presence_choice_and_what_others_see(): void
    {
        $user = User::factory()->create(['last_seen_at' => now()]);
        $this->assertSame('online', $user->toCard()['presence']);

        $this->actingAs($user)->putJson('/me/presence', ['presence' => 'dnd'])->assertOk();
        $user->refresh();
        $this->assertSame('dnd', $user->toCard()['presence']);
        $this->assertTrue($user->doNotDisturb());

        $this->actingAs($user)->putJson('/me/presence', ['presence' => 'invisible'])->assertOk();
        $user->refresh();
        $this->assertSame('offline', $user->toCard()['presence']);
        $this->assertFalse($user->toCard()['is_online']);

        $this->actingAs($user)->putJson('/me/presence', ['presence' => 'away'])->assertUnprocessable();

        // Сам стає «Неактивним» після 10 хвилин без дій.
        $this->actingAs($user)->putJson('/me/presence', ['presence' => 'online'])->assertOk();
        $user->refresh()->forceFill(['last_seen_at' => now()->subMinutes(12)])->save();
        $this->assertSame('idle', $user->toCard()['presence']);
    }
}
