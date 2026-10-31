<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Game;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** «Готовий грати зараз»: свій стан, друзі, підбір тиммейтів, профіль, міст. */
class ReadyToPlayTest extends TestCase
{
    use RefreshDatabase;

    private function friends(User $a, User $b): void
    {
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
    }

    public function test_friend_sees_ready_and_it_expires(): void
    {
        $me = User::factory()->create(['username' => 'readyguy']);
        $friend = User::factory()->create();
        $stranger = User::factory()->create();
        $this->friends($me, $friend);
        Game::query()->create(['slug' => 'apex', 'name' => 'Apex', 'letter' => 'A', 'category' => 'pc', 'is_published' => true]);

        $this->actingAs($me)->putJson('/ready', ['game' => 'apex', 'minutes' => 60, 'note' => 'є мікро'])->assertOk()
            ->assertJsonPath('mine.game.slug', 'apex')->assertJsonPath('mine.note', 'є мікро');

        $this->actingAs($friend)->getJson('/ready')->assertOk()
            ->assertJsonPath('friends.0.user.id', $me->id)->assertJsonPath('friends.0.game.name', 'Apex');
        $this->actingAs($stranger)->getJson('/ready')->assertOk()->assertJsonCount(0, 'friends');
        $this->actingAs($friend)->get('/'.$me->username)->assertInertia(fn (Assert $page) => $page->where('ready.game.slug', 'apex'));

        $this->travel(61)->minutes();
        $this->actingAs($friend)->getJson('/ready')->assertJsonCount(0, 'friends');
        $this->actingAs($me)->getJson('/ready')->assertJsonPath('mine', null);
    }

    public function test_ready_puts_teammate_profile_into_matching_and_stop_clears_it(): void
    {
        $me = User::factory()->create();
        TeammateProfile::query()->create(['user_id' => $me->id, 'games' => [], 'languages' => ['uk'], 'times' => [], 'mic' => true, 'visible' => true]);

        $this->actingAs($me)->putJson('/ready', ['minutes' => 30])->assertOk()->assertJsonPath('mine.game', null);
        $this->assertTrue(TeammateProfile::query()->where('user_id', $me->id)->first()->isLooking());

        $this->actingAs($me)->deleteJson('/ready')->assertOk()->assertJsonPath('mine', null);
        $this->assertFalse(TeammateProfile::query()->where('user_id', $me->id)->first()->isLooking());
    }

    public function test_validation_bridge_and_plugin(): void
    {
        $me = User::factory()->create();

        $this->actingAs($me)->putJson('/ready', ['minutes' => 45])->assertUnprocessable();
        $this->actingAs($me)->putJson('/ready', ['minutes' => 60, 'game' => 'missing'])->assertNotFound();

        $token = app(ApiTokens::class)->issue($me, 'android');
        $this->withToken($token)->putJson('/api/v1/site/ready', ['minutes' => 120])->assertOk()->assertJsonStructure(['mine', 'friends', 'games', 'durations']);

        app(Plugins::class)->set('ready_to_play', false);
        $this->actingAs($me)->getJson('/ready')->assertNotFound();
    }
}
