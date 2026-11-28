<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** №279: хто з друзів Steam уже на GameCon — і заявки одним натиском. */
class FriendImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app(SiteSettings::class)->putSecret('steam_api_key', 'ABCDEF0123456789ABCDEF0123456789');
    }

    public function test_finds_steam_friends_on_gamecon_and_sends_requests(): void
    {
        $me = User::factory()->create(['steam_id' => '76561198000000001']);
        $anna = User::factory()->create(['steam_id' => '76561198000000002']);
        $bohdan = User::factory()->create(['steam_id' => '76561198000000003']);
        $blocker = User::factory()->create(['steam_id' => '76561198000000004']);
        $friend = User::factory()->create(['steam_id' => '76561198000000005']);
        User::factory()->create(['steam_id' => '76561198000000099']); // не друг у Steam
        UserBlock::query()->create(['user_id' => $blocker->id, 'blocked_id' => $me->id]);
        Friendship::query()->create(['requester_id' => $me->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED]);
        Http::fake(['api.steampowered.com/ISteamUser/GetFriendList/*' => Http::response(['friendslist' => ['friends' => [
            ['steamid' => '76561198000000002'], ['steamid' => '76561198000000003'],
            ['steamid' => '76561198000000004'], ['steamid' => '76561198000000005'], ['steamid' => '76561198000000777'],
        ]]])]);

        $response = $this->actingAs($me)->getJson('/friends/import/steam')->assertOk()->assertJsonPath('status', 'ok');
        $ids = collect($response->json('people'))->pluck('user.id')->all();
        $this->assertEqualsCanonicalizing([$anna->id, $bohdan->id, $friend->id], $ids, 'без того, хто заблокував, і без чужих');
        $this->assertSame('friends', collect($response->json('people'))->firstWhere('user.id', $friend->id)['state']);

        // «Додати всіх»: заявки лише знайденим — чужий id ігнорується.
        $stranger = User::factory()->create();
        $this->actingAs($me)->postJson('/friends/import/steam', ['ids' => [$anna->id, $bohdan->id, $stranger->id]])
            ->assertOk()->assertJsonPath('sent', 2);
        $this->assertSame(2, Friendship::query()->where('requester_id', $me->id)->where('status', Friendship::PENDING)->count());
        $this->assertFalse(Friendship::query()->where('addressee_id', $stranger->id)->exists());
    }

    public function test_private_list_and_missing_steam_are_explained(): void
    {
        $noSteam = User::factory()->create();
        $this->actingAs($noSteam)->getJson('/friends/import/steam')->assertJsonPath('status', 'no_steam');

        $me = User::factory()->create(['steam_id' => '76561198000000001']);
        Http::fake(['api.steampowered.com/*' => Http::response([], 401)]);
        $this->actingAs($me)->getJson('/friends/import/steam')->assertJsonPath('status', 'private');
    }
}
