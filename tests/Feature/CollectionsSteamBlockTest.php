<?php

namespace Tests\Feature;

use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Families\FamilyService;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CollectionsSteamBlockTest extends TestCase
{
    use RefreshDatabase;

    private function game(array $attributes = []): Game
    {
        return Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
            'links' => [['store' => 'steam', 'url' => 'https://store.steampowered.com/app/629730/Nova_Drift/']],
            ...$attributes,
        ]);
    }

    public function test_staff_curates_collections_and_friends_with_the_steam_game_are_listed(): void
    {
        $viewer = User::factory()->create();
        $friend = User::factory()->create();
        $stranger = User::factory()->create();
        $staff = User::factory()->create(['role' => User::ROLE_MODERATOR]);
        $friendships = app(FriendshipService::class);
        $friendships->request($viewer, $friend);
        $friendships->accept($friend, $viewer);
        $game = $this->game();
        $other = $this->game(['slug' => 'other', 'name' => 'Other', 'letter' => 'O', 'links' => null]);
        DB::table('user_steam_apps')->insert([
            ['user_id' => $friend->id, 'app_id' => '629730'],
            ['user_id' => $stranger->id, 'app_id' => '629730'],
        ]);

        $this->actingAs($viewer)->post(route('games.collections', $game), ['duo' => true, 'evening' => true])->assertForbidden();
        $this->actingAs($staff)->post(route('games.collections', $game), ['duo' => true])->assertRedirect();
        $this->assertSame(['duo'], $game->fresh()->collections);

        $this->actingAs($viewer)->getJson(route('games.index', ['collection' => 'duo']))
            ->assertOk()
            ->assertJsonPath('games.data.0.slug', 'nova-drift')
            ->assertJsonCount(1, 'games.data');

        $this->actingAs($viewer)->getJson(route('games.show', $game))
            ->assertOk()
            ->assertJsonPath('steam_friends.0.username', $friend->username)
            ->assertJsonCount(1, 'steam_friends');

        $this->assertNotSame($other->id, $game->id);
    }

    public function test_a_family_leader_can_block_someone_from_applying(): void
    {
        Storage::fake('public');
        Http::preventStrayRequests();
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $leader = User::factory()->create();
        $member = User::factory()->create();
        $applicant = User::factory()->create();
        $families = app(FamilyService::class);
        $family = $families->create($leader, [
            'server_id' => $server->id,
            'name' => 'Scaletta Family',
            'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '10001',
        ]);
        $families->setStatus($family, User::factory()->admin()->create(), 'verified', null);
        $family->refresh();
        FamilyMember::query()->create([
            'family_id' => $family->id,
            'user_id' => $member->id,
            'rp_nickname' => 'Tony_Moretti',
            'static_id' => '20002',
            'status' => FamilyMember::STATUS_ACTIVE,
            'rank' => 1,
        ]);

        $this->actingAs($member)->post(route('families.block', $family), ['username' => $applicant->username])->assertForbidden();
        $this->actingAs($leader)->post(route('families.block', $family), ['username' => $applicant->username])->assertRedirect();

        $this->actingAs($applicant)->post(route('families.apply', $family), [
            'rp_nickname' => 'Luca_Brasi',
            'static_id' => '777',
        ])->assertSessionHasErrors('family');

        $this->actingAs($leader)->delete(route('families.unblock', [$family, $applicant]))->assertRedirect();
        $this->actingAs($applicant)->post(route('families.apply', $family), [
            'rp_nickname' => 'Luca_Brasi',
            'static_id' => '777',
        ])->assertRedirect()->assertSessionHasNoErrors();
    }
}
