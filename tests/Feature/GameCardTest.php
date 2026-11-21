<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\PlayedPlace;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class GameCardTest extends TestCase
{
    use RefreshDatabase;

    public function test_card_shows_level_games_and_respects_private_profile(): void
    {
        [$owner, $friend, $stranger] = User::factory()->count(3)->create();
        $game = Game::query()->create(['slug' => 'gta-v', 'name' => 'GTA V', 'letter' => 'G', 'category' => 'pc', 'is_published' => true]);
        PlayedPlace::query()->create(['user_id' => $owner->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id]);

        $this->get("/{$owner->username}/card")->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('profile/card')
            ->where('game.games', ['GTA V'])
            ->has('game.level')
            ->has('qr'));

        // Закритий профіль: стороннім — без ігор, другу — повністю.
        $owner->forceFill(['is_private' => true])->save();
        cache()->flush();
        app(FriendshipService::class)->request($owner, $friend);
        app(FriendshipService::class)->accept($friend, $owner);
        $this->actingAs($stranger)->get("/{$owner->username}/card")->assertInertia(fn (AssertableInertia $page) => $page->where('game.games', []));
        $this->actingAs($friend)->get("/{$owner->username}/card")->assertInertia(fn (AssertableInertia $page) => $page->where('game.games', ['GTA V']));
    }
}
