<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Services\Games\GameCatalog;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GamesCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_starter_list_is_searchable_by_name_section_and_letter(): void
    {
        app(GameCatalog::class)->seed();
        $user = User::factory()->create();

        $this->actingAs($user)->getJson(route('games.index', ['q' => 'counter']))
            ->assertOk()
            ->assertJsonPath('games.data.0.name', 'Counter-Strike 2');

        $this->actingAs($user)->getJson(route('games.index', ['category' => 'mobile', 'letter' => 'B']))
            ->assertOk()
            ->assertJsonFragment(['name' => 'Brawl Stars'])
            ->assertJsonMissing(['name' => 'Counter-Strike 2']);

        $this->actingAs($user)->getJson(route('games.show', 'counter-strike-2'))
            ->assertOk()
            ->assertJsonPath('game.links.0.label', 'Steam')
            ->assertJsonPath('game.links.0.url', 'https://store.steampowered.com/app/730/');

        $this->actingAs($user)->getJson(route('games.search', ['q' => 'pubg']))->assertJsonCount(2, 'games');
    }

    public function test_rawg_sync_adds_games_and_store_links(): void
    {
        app(SiteSettings::class)->putSecret('rawg_key', str_repeat('a', 32));
        Http::preventStrayRequests();
        Http::fake([
            'api.rawg.io/api/games/999/stores*' => Http::response(['results' => [['store_id' => 8, 'url' => 'https://play.google.com/store/apps/details?id=x.y']]]),
            'api.rawg.io/api/games*' => Http::response(['next' => null, 'results' => [[
                'id' => 999, 'slug' => 'x-arena', 'name' => 'X Arena', 'released' => '2024-05-01', 'rating' => 4.2, 'added' => 5000,
                'background_image' => 'https://media.rawg.io/x.jpg',
                'platforms' => [['platform' => ['slug' => 'android']], ['platform' => ['slug' => 'ios']]],
                'genres' => [['name' => 'Action']],
            ]]]),
        ]);

        $result = app(GameCatalog::class)->sync(1, 10);

        $this->assertGreaterThanOrEqual(1, $result['games']);
        $game = Game::query()->where('rawg_id', 999)->sole();
        $this->assertSame('X', $game->letter);
        $this->assertSame(['android', 'ios'], $game->platforms);
        $this->assertSame('gplay', $game->links[0]['store']);
    }
}
