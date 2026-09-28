<?php

namespace Tests\Feature;

use App\Cinema\CinemaSettings;
use App\Cinema\Importer;
use App\Cinema\Shikimori;
use App\Cinema\Title;
use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Shikimori (shikimori.one) — автоматичний shikimori_id для аніме: без
 * нього Kodik::search() шукає лише за назвою/роком, що для азійського
 * контенту часто хибить (TMDB рідко дає IMDb id для аніме).
 */
class ShikimoriTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, 'test-v3-key');
        Http::preventStrayRequests();
    }

    private function admin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    public function test_search_picks_exact_name_match(): void
    {
        Http::fake(['shikimori.one/api/animes*' => Http::response([
            ['id' => 269, 'name' => 'Bleach', 'russian' => 'Блич', 'aired_on' => '2004-10-05', 'kind' => 'tv'],
            ['id' => 41084, 'name' => 'Bleach: Sennen Kessen-hen', 'russian' => 'Блич: Тысячелетняя кровавая война', 'aired_on' => '2022-10-11', 'kind' => 'tv'],
        ])]);
        $title = Title::create(['tmdb_id' => 1, 'type' => 'series', 'category' => 'anime', 'name' => 'Bleach', 'year' => 2004]);

        $match = Shikimori::search($title);

        $this->assertSame(269, $match['id']);
    }

    public function test_search_returns_null_when_ambiguous_and_no_year_to_disambiguate(): void
    {
        Http::fake(['shikimori.one/api/animes*' => Http::response([
            ['id' => 1, 'name' => 'Ghost in the Shell', 'russian' => null, 'aired_on' => '1995-11-18', 'kind' => 'movie'],
            ['id' => 2, 'name' => 'Ghost in the Shell', 'russian' => null, 'aired_on' => '2004-03-06', 'kind' => 'movie'],
        ])]);
        $title = Title::create(['tmdb_id' => 2, 'type' => 'movie', 'category' => 'anime', 'name' => 'Ghost in the Shell']);

        $this->assertNull(Shikimori::search($title));
    }

    public function test_search_disambiguates_by_year_when_multiple_exact_matches(): void
    {
        Http::fake(['shikimori.one/api/animes*' => Http::response([
            ['id' => 1, 'name' => 'Ghost in the Shell', 'russian' => null, 'aired_on' => '1995-11-18', 'kind' => 'movie'],
            ['id' => 2, 'name' => 'Ghost in the Shell', 'russian' => null, 'aired_on' => '2004-03-06', 'kind' => 'movie'],
        ])]);
        $title = Title::create(['tmdb_id' => 3, 'type' => 'movie', 'category' => 'anime', 'name' => 'Ghost in the Shell', 'year' => 1995]);

        $this->assertSame(1, Shikimori::search($title)['id']);
    }

    public function test_attach_saves_id_and_throttle_marker(): void
    {
        Http::fake(['shikimori.one/api/animes*' => Http::response([
            ['id' => 269, 'name' => 'Bleach', 'russian' => 'Блич', 'aired_on' => '2004-10-05', 'kind' => 'tv'],
        ])]);
        $title = Title::create(['tmdb_id' => 4, 'type' => 'series', 'category' => 'anime', 'name' => 'Bleach', 'year' => 2004]);

        $this->assertTrue(Shikimori::attach($title));

        $title->refresh();
        $this->assertSame(269, $title->shikimori_id);
        $this->assertNotNull($title->shikimori_checked_at);
    }

    /** Importer::import підставляє shikimori_id автоматично — ще до Kodik, аби той міг ним скористатись у той самий виклик. */
    public function test_importer_auto_fills_shikimori_id_for_anime(): void
    {
        Http::fake([
            'api.themoviedb.org/3/tv/700*' => Http::response([
                'id' => 700, 'name' => 'Bleach', 'original_name' => 'Bleach', 'first_air_date' => '2004-10-05',
                'genres' => [['id' => 16, 'name' => 'Анімація']], 'original_language' => 'ja',
            ]),
            'shikimori.one/api/animes*' => Http::response([
                ['id' => 269, 'name' => 'Bleach', 'russian' => 'Блич', 'aired_on' => '2004-10-05', 'kind' => 'tv'],
            ]),
        ]);

        $title = Importer::import('series', 700, attachPlayers: true);

        $this->assertSame('anime', $title->category);
        $this->assertSame(269, $title->shikimori_id);
    }

    /** cinema:auto-import дошукує shikimori_id для аніме, імпортованого до появи цього поля. */
    public function test_auto_import_retries_missing_shikimori_id_for_anime(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::createFromTimestamp(0));
        Http::fake([
            'api.themoviedb.org/3/trending/all/week*' => Http::response(['results' => []]),
            'shikimori.one/api/animes*' => Http::response([
                ['id' => 269, 'name' => 'Bleach', 'russian' => 'Блич', 'aired_on' => '2004-10-05', 'kind' => 'tv'],
            ]),
        ]);
        $title = Title::create(['tmdb_id' => 5, 'type' => 'series', 'category' => 'anime', 'name' => 'Bleach', 'year' => 2004]);

        $this->artisan('cinema:auto-import')->assertSuccessful();

        $this->assertSame(269, $title->fresh()->shikimori_id);
        $this->travelBack();
    }

    public function test_admin_bulk_button_queues_only_anime_missing_shikimori_id(): void
    {
        $this->actingAs($this->admin());
        \Illuminate\Support\Facades\Queue::fake();
        $needsIt = Title::create(['tmdb_id' => 6, 'type' => 'series', 'category' => 'anime', 'name' => 'Наруто']);
        Title::create(['tmdb_id' => 7, 'type' => 'series', 'category' => 'anime', 'name' => 'Вже є', 'shikimori_id' => 20]);
        Title::create(['tmdb_id' => 8, 'type' => 'movie', 'category' => 'movie', 'name' => 'Не аніме']);

        $this->post('/admin/cinema/bulk-attach-players', ['source' => 'shikimori'])->assertRedirect()->assertSessionHasNoErrors();

        \Illuminate\Support\Facades\Queue::assertPushed(\App\Cinema\AttachPlayerJob::class, 1);
        \Illuminate\Support\Facades\Queue::assertPushed(fn (\App\Cinema\AttachPlayerJob $j) => $j->source === 'shikimori' && $j->titleId === $needsIt->id);
    }
}
