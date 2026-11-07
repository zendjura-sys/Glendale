<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\User;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Ліва колонка (Gamer Dock): картка гравця, голосові кімнати й друзі в грі приходять з /me/rail. */
class GamerDockTest extends TestCase
{
    use RefreshDatabase;

    public function test_rail_returns_player_card_voice_and_in_game_blocks(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/me/rail')->assertOk()
            ->assertJsonStructure([
                'me' => ['level', 'streak', 'family', 'track', 'playing'],
                'voice',
                'in_game',
                'requests',
                'contacts',
            ])
            ->assertJsonPath('voice', [])
            ->assertJsonPath('in_game', []);
    }

    public function test_rail_feeds_season_and_top_servers_widgets(): void
    {
        $user = User::factory()->create();
        foreach ([['busy-rp', 'Busy RP', 800, true], ['calm-rp', 'Calm RP', 40, false], ['empty-rp', 'Empty RP', 0, false]] as [$slug, $name, $online, $featured]) {
            GtaServer::query()->forceCreate([
                'slug' => $slug, 'name' => $name, 'platform' => 'pc', 'multiplayer' => 'ragemp',
                'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
                'players_online' => $online, 'players_max' => 1000, 'is_featured' => $featured,
            ]);
        }

        $this->actingAs($user)->getJson('/me/rail')->assertOk()
            ->assertJsonStructure(['season' => ['title', 'level', 'into', 'need', 'max_level']])
            ->assertJsonCount(2, 'servers')
            ->assertJsonPath('servers.0.name', 'Busy RP')
            ->assertJsonPath('servers.0.online', 800)
            ->assertJsonPath('servers.0.featured', true)
            ->assertJsonPath('servers.1.href', '/servers/calm-rp');
    }

    public function test_hub_returns_family_headquarters_summary(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $family = app(FamilyService::class)->create($user, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $family->forceFill(['treasury' => 1500])->save();

        $this->actingAs($user)->getJson('/me/hub')->assertOk()
            ->assertJsonPath('family.treasury', 1500)
            ->assertJsonPath('family.slug', $family->slug)
            ->assertJsonStructure(['alerts', 'family' => ['name', 'items', 'low_stock', 'pending_reports']])
            // RP-досьє персонажа в меню: нік, ранг лідера, баланс і догани.
            ->assertJsonPath('family.dossier.nickname', 'Marco_Scaletta [10001]')
            ->assertJsonPath('family.dossier.rank', 10)
            ->assertJsonPath('family.dossier.warns', 0)
            ->assertJsonPath('family.dossier.server', 'Quant RP');

        $this->actingAs($user)->getJson('/me/rail')->assertOk()
            ->assertJsonPath('me.family.rank', 10)
            ->assertJsonPath('me.family.href', '/f/'.$family->slug);
    }

    public function test_composer_can_search_and_attach_a_movie_card(): void
    {
        $user = User::factory()->create();
        $movie = Movie::query()->create(['slug' => 'dune', 'type' => 'movie', 'title' => 'Дюна', 'is_published' => true]);

        $this->actingAs($user)->getJson('/cards/search?q='.urlencode('Дюна').'&kind=movie')->assertOk()
            ->assertJsonPath('cards.0.kind', 'movie')
            ->assertJsonPath('cards.0.id', $movie->id);
        $this->actingAs($user)->getJson('/cards/search?q='.urlencode('Дюна').'&kind=game')->assertOk()
            ->assertJsonCount(0, 'cards');

        $this->actingAs($user)->post('/posts', ['body' => 'Дивіться', 'visibility' => 'public', 'card' => ['kind' => 'movie', 'id' => $movie->id]])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('posts', ['author_id' => $user->id, 'body' => 'Дивіться']);
    }
}
