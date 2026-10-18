<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PlayedPlace;
use App\Models\ServerReview;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReviewsLibraryConsolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_players_review_a_server_and_consoles_and_steam_library_show_on_the_profile(): void
    {
        Http::preventStrayRequests();
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp',
            'name' => 'Quant RP',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
        $player = User::factory()->create(['steam_id' => '76561198000000001']);
        $visitor = User::factory()->create();

        $this->actingAs($visitor)->post(route('servers.reviews.store', $server), [
            'stars' => 5,
            'body' => 'Зайшов подивитись',
        ])->assertForbidden();
        $this->assertSame(0, ServerReview::query()->count());

        $this->actingAs($player)->put(route('playing.update'), [
            'kind' => 'server',
            'id' => $server->id,
            'hours' => 1,
        ])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('played_places', [
            'user_id' => $player->id,
            'kind' => PlayedPlace::SERVER,
            'subject_id' => $server->id,
        ]);

        $this->actingAs($player)->post(route('servers.reviews.store', $server), [
            'stars' => 4,
            'body' => 'Стабільний онлайн',
        ])->assertRedirect()->assertSessionHasNoErrors();
        $this->actingAs($player)->post(route('servers.reviews.store', $server), [
            'stars' => 5,
            'body' => 'Ще краще',
        ])->assertRedirect();
        $this->assertSame(1, ServerReview::query()->count());
        $this->assertSame(5, ServerReview::query()->first()?->stars);

        $this->withoutVite()->actingAs($visitor)->get(route('servers.show', $server))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('reviews.can_review', false)
                ->where('reviews.average', 5)
                ->where('reviews.count', 1)
                ->where('reviews.items.0.username', $player->username)
                ->where('reviews.items.0.body', 'Ще краще'));

        $this->actingAs($player)->put(route('playing.consoles'), [
            'xbox' => 'bad tag!',
            'playstation' => 'nova_ps',
        ])->assertSessionHasErrors('xbox');

        $this->actingAs($player)->put(route('playing.consoles'), [
            'xbox' => 'Nova Player',
            'playstation' => 'nova_ps',
        ])->assertRedirect()->assertSessionHasNoErrors();
        $fresh = $player->fresh();
        $this->assertSame('Nova Player', $fresh?->pref('xbox'));
        $this->assertSame('nova_ps', $fresh?->pref('playstation'));

        app(SiteSettings::class)->putSecret('steam_api_key', str_repeat('B', 32));
        Http::fake([
            'api.steampowered.com/IPlayerService/GetOwnedGames/*' => Http::response([
                'response' => [
                    'games' => [
                        ['appid' => 570, 'name' => 'Dota 2', 'playtime_forever' => 30],
                        ['appid' => 730, 'name' => 'Counter-Strike 2', 'playtime_forever' => 180],
                    ],
                ],
            ]),
        ]);
        Game::query()->create([
            'slug' => 'counter-strike-2',
            'name' => 'Counter-Strike 2',
            'letter' => 'C',
            'category' => 'pc',
            'is_published' => true,
            'links' => [['store' => 'steam', 'url' => 'https://store.steampowered.com/app/730']],
        ]);

        $this->withoutVite()->actingAs($player)->get(route('profile.show', $player))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('profile.platforms.xbox_name', 'Nova Player')
                ->where('profile.platforms.xbox', 'https://www.xbox.com/play/user/Nova%20Player')
                ->where('profile.platforms.playstation_name', 'nova_ps')
                ->where('profile.platforms.playstation', 'https://psnprofiles.com/nova_ps')
                ->where('profile.platforms.steam', 'https://steamcommunity.com/profiles/76561198000000001')
                ->where('steamLibrary.0.name', 'Counter-Strike 2')
                ->where('steamLibrary.0.hours', 3)
                ->where('steamLibrary.0.href', '/games/counter-strike-2')
                ->where('steamLibrary.1.name', 'Dota 2')
                ->where('steamLibrary.1.href', null));
    }
}
