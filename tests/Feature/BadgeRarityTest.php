<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\Achievements;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/** Рідкість бейджів: нічний перерахунок за активними людьми і «є у N% людей». */
class BadgeRarityTest extends TestCase
{
    use RefreshDatabase;

    public function test_nightly_recount_gives_share_of_active_people(): void
    {
        $users = User::factory()->count(25)->create(['last_seen_at' => now()]);
        // Давно не заходив — у підрахунок не потрапляє.
        User::factory()->create(['last_seen_at' => now()->subYear()]);
        Post::factory()->create(['author_id' => $users[0]->id]);

        $this->artisan('achievements:rarity')->assertSuccessful();
        $this->assertDatabaseHas('achievement_rarity', ['badge' => 'first_post', 'holders' => 1, 'total' => 25]);

        Cache::flush();
        $badge = collect(app(Achievements::class)->for($users[0])['badges'])->firstWhere('key', 'first_post');
        $this->assertSame(4.0, $badge['rarity']);
    }

    public function test_too_few_people_or_plugin_off_hides_rarity(): void
    {
        $user = User::factory()->create(['last_seen_at' => now()]);
        $this->artisan('achievements:rarity')->assertSuccessful();
        Cache::flush();
        $this->assertNull(collect(app(Achievements::class)->for($user)['badges'])->firstWhere('key', 'first_post')['rarity']);

        app(Plugins::class)->set('badge_rarity', false);
        $this->artisan('achievements:rarity')->assertSuccessful();
        $this->assertSame([], app(Achievements::class)->rarity());
    }
}
