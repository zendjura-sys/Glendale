<?php

namespace Tests\Feature;

use App\Models\Follow;
use App\Models\Game;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PinPeopleReactionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_pin_shared_game_people_and_reactions(): void
    {
        [$owner, $mate] = User::factory()->count(2)->create();
        $game = Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
        ]);
        Follow::query()->create(['user_id' => $owner->id, 'kind' => 'game', 'subject_id' => $game->id]);
        Follow::query()->create(['user_id' => $mate->id, 'kind' => 'game', 'subject_id' => $game->id]);

        $this->withoutVite()->actingAs($owner)->get(route('feed'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('sameGame.0.username', $mate->username)
                ->where('sameGame.0.shared_game', 'Nova Drift'));

        $this->actingAs($owner)->postJson(route('profile.pin'), ['kind' => 'game', 'id' => $game->id])
            ->assertOk()
            ->assertJsonPath('pinned', true)
            ->assertJsonPath('pin.title', 'Nova Drift');

        $this->withoutVite()->actingAs($mate)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('profile.pin.title', 'Nova Drift'));

        $this->actingAs($owner)->post(route('posts.store'), [
            'body' => 'Рейд',
            'visibility' => 'public',
        ])->assertRedirect();
        $post = Post::query()->firstOrFail();

        $this->actingAs($mate)->postJson(route('posts.like', $post), ['reaction' => 'fire'])
            ->assertOk()
            ->assertJsonPath('reaction', 'fire')
            ->assertJsonPath('likes_count', 1);
        $this->actingAs($mate)->postJson(route('posts.like', $post), ['reaction' => 'gg'])
            ->assertOk()
            ->assertJsonPath('reaction', 'gg')
            ->assertJsonPath('likes_count', 1);
        $this->actingAs($mate)->postJson(route('posts.like', $post), ['reaction' => 'gg'])
            ->assertOk()
            ->assertJsonPath('reaction', null)
            ->assertJsonPath('likes_count', 0);
    }
}
