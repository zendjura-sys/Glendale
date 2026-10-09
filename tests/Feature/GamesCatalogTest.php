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

    public function test_igdb_sync_is_preferred_and_fills_the_full_game_card(): void
    {
        app(GameCatalog::class)->seed();
        $settings = app(SiteSettings::class);
        $settings->put(['igdb_client_id' => str_repeat('a', 30)]);
        $settings->putSecret('igdb_client_secret', str_repeat('b', 30));
        $settings->putSecret('rawg_key', str_repeat('a', 32));
        Http::preventStrayRequests();
        Http::fake([
            'id.twitch.tv/oauth2/token' => Http::response(['access_token' => 'tok', 'expires_in' => 5000000]),
            'api.igdb.com/v4/game_time_to_beats' => Http::response([['game_id' => 777, 'hastily' => 7200, 'normally' => 36000]]),
            'api.igdb.com/v4/games' => Http::sequence()
                ->push([[
                    'id' => 1942, 'slug' => 'counter-strike-2', 'name' => 'Counter-Strike 2', 'platforms' => [6],
                    'total_rating' => 80, 'total_rating_count' => 3000, 'first_release_date' => 1695686400,
                    'websites' => [['url' => 'https://store.steampowered.com/app/730/'], ['url' => 'https://www.counter-strike.net']],
                ]])
                ->push([[
                    'id' => 777, 'slug' => 'pocket-raid', 'name' => 'Pocket Raid', 'platforms' => [34, 39],
                    'summary' => 'Командні рейди.', 'genres' => [5, 31], 'themes' => [1, 42], 'game_modes' => [2, 3, 6], 'player_perspectives' => [2],
                    'cover' => ['image_id' => 'co1abc'], 'screenshots' => [['image_id' => 'sc1']], 'videos' => [['video_id' => 'dQw4w9WgXcQ', 'name' => 'Trailer']],
                    'total_rating_count' => 4, 'aggregated_rating' => 81.4, 'rating' => 77.2, 'rating_count' => 40,
                    'involved_companies' => [['developer' => true, 'publisher' => false, 'company' => ['name' => 'Raid Studio']], ['developer' => false, 'publisher' => true, 'company' => ['name' => 'Big Pub']]],
                    'multiplayer_modes' => [['onlinemax' => 4, 'onlinecoop' => true], ['onlinemax' => 8, 'splitscreen' => true]],
                    'age_ratings' => [['organization' => 2, 'rating_category' => 4]],
                    'release_dates' => [['platform' => 39, 'date' => 1700000000], ['platform' => 34, 'date' => 1690000000]],
                    'language_supports' => [['language' => ['name' => 'English'], 'language_support_type' => 3], ['language' => ['name' => 'Ukrainian'], 'language_support_type' => 2]],
                    'alternative_names' => [['name' => 'Кишеньковий рейд']],
                    'similar_games' => [1942],
                    'websites' => [['url' => 'https://play.google.com/store/apps/details?id=pocket.raid'], ['url' => 'https://apps.apple.com/app/id1'], ['url' => 'https://discord.gg/raid'], ['url' => 'https://raid.example']],
                ]])
                ->push([]),
        ]);

        $result = app(GameCatalog::class)->sync(1);

        $this->assertSame(2, $result['games']);
        // Гра зі стартового списку не дублюється: отримує igdb_id, посилання Steam лишається одне.
        $cs = Game::query()->where('slug', 'counter-strike-2')->sole();
        $this->assertSame(1942, $cs->igdb_id);
        $this->assertSame(['steam'], array_column($cs->links ?? [], 'store'));

        $game = Game::query()->where('igdb_id', 777)->sole();
        $this->assertSame('mobile', $game->category);
        $this->assertSame(['android', 'ios'], $game->platforms);
        $this->assertSame(['Шутер', 'Пригоди', 'Екшн'], $game->genres);
        $this->assertSame(['multiplayer', 'coop', 'battle_royale'], $game->modes);
        $this->assertSame(['gplay', 'appstore'], array_column($game->links ?? [], 'store'));
        $this->assertSame('https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg', $game->cover);
        Http::assertSent(fn ($request) => $request->hasHeader('Client-ID', str_repeat('a', 30)) && str_contains($request->body(), 'themes != (42)'));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'rawg.io'));

        $user = User::factory()->create();
        $this->actingAs($user)->getJson(route('games.show', $game))
            ->assertOk()
            ->assertJsonPath('game.details.summary', 'Командні рейди.')
            ->assertJsonPath('game.details.developers.0', 'Raid Studio')
            ->assertJsonPath('game.details.publishers.0', 'Big Pub')
            ->assertJsonPath('game.details.multiplayer.online_max', 8)
            ->assertJsonPath('game.details.multiplayer.split_screen', true)
            ->assertJsonPath('game.details.age_ratings.0', 'PEGI 16')
            ->assertJsonPath('game.details.release_dates.0.platform', 'Android')
            ->assertJsonPath('game.details.languages.0.name', 'Українська')
            ->assertJsonPath('game.details.languages.0.subtitles', true)
            ->assertJsonPath('game.details.ratings.critics', 81)
            ->assertJsonPath('game.details.videos.0.id', 'dQw4w9WgXcQ')
            ->assertJsonPath('game.details.time_to_beat.normally', 10)
            ->assertJsonPath('game.details.websites.0.kind', 'discord')
            ->assertJsonPath('game.details.websites.1.kind', 'official')
            ->assertJsonPath('game.modes.2.label', 'Королівська битва')
            ->assertJsonPath('similar.0.slug', 'counter-strike-2');

        // Фільтри каталогу: режим, жанр і пошук за альтернативною назвою.
        $this->actingAs($user)->getJson(route('games.index', ['mode' => 'battle_royale']))->assertJsonPath('games.data.0.slug', 'pocket-raid')->assertJsonCount(1, 'games.data');
        $this->actingAs($user)->getJson(route('games.index', ['genre' => 'Пригоди', 'sort' => 'rating']))->assertJsonFragment(['slug' => 'pocket-raid']);
        $this->actingAs($user)->getJson(route('games.index', ['q' => 'Кишеньковий']))->assertJsonPath('games.data.0.slug', 'pocket-raid');
    }

    public function test_admin_turns_catalog_features_off_for_site_and_app(): void
    {
        app(GameCatalog::class)->seed();
        $game = Game::query()->where('slug', 'counter-strike-2')->sole();
        $game->update(['modes' => ['multiplayer'], 'details' => ['summary' => 'Опис', 'videos' => [['id' => 'dQw4w9WgXcQ', 'name' => 'T']], 'languages' => [['name' => 'Українська', 'audio' => false, 'subtitles' => true, 'interface' => true]]]]);
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();

        $this->actingAs($user)->get('/admin/games')->assertForbidden();
        $this->actingAs($admin)->get('/admin/games')->assertOk();

        $off = array_fill_keys(array_keys(Game::FEATURES), true);
        $off['media'] = false;
        $off['filter_modes'] = false;
        $off['clans'] = false;
        $this->actingAs($admin)->put('/admin/games/features', $off)->assertSessionHasNoErrors();

        $this->actingAs($user)->getJson(route('games.show', $game))
            ->assertOk()
            ->assertJsonPath('game.details.summary', 'Опис')
            ->assertJsonPath('game.details.languages.0.name', 'Українська')
            ->assertJsonMissingPath('game.details.videos')
            ->assertJsonPath('features.media', false)
            ->assertJsonPath('clans', []);
        // Вимкнений фільтр ігнорується: режим не звужує список.
        $this->actingAs($user)->getJson(route('games.index', ['mode' => 'battle_royale']))
            ->assertJsonPath('filters.mode', null)
            ->assertJsonPath('modes', []);

        $this->actingAs($admin)->patch("/admin/games/{$game->id}", ['is_published' => false])->assertSessionHasNoErrors();
        $this->actingAs($user)->getJson(route('games.show', $game))->assertNotFound();
    }
}
