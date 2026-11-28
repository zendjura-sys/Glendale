<?php

namespace Tests\Feature;

use App\Jobs\AssignCinemaPlayers;
use App\Jobs\RefreshMoviePlayers;
use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use App\Services\Cinema\BulkPlayers;
use App\Services\Cinema\CinemaService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Масове призначення плеєрів: «лише нові» не чіпає наявні, «замінити» оновлює; звіт — що змінено. */
class BulkPlayersTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<array<string, mixed>> */
    private array $results = [];

    /** @var list<array<string, mixed>>|null відповідь Kodik на пошук за Shikimori ID */
    private ?array $shikimori = null;

    /**
     * @return array<string, mixed>
     */
    private function item(string $id, string $voice, string $hash = 'hash'): array
    {
        return [
            'id' => $id, 'type' => 'foreign-movie', 'link' => "//kodik.info/video/{$id}/{$hash}/720p",
            'title' => 'Матриця', 'title_orig' => 'The Matrix', 'year' => 1999, 'kinopoisk_id' => '301',
            'translation' => ['id' => 1, 'title' => $voice, 'type' => 'voice'], 'quality' => 'WEB-DLRip 720p',
        ];
    }

    private function movie(): Movie
    {
        $movie = Movie::query()->create(['slug' => 'matrix', 'type' => 'movie', 'title' => 'Матриця', 'year' => 1999, 'kinopoisk_id' => '301', 'is_published' => true]);
        $source = new MovieSource(['provider' => 'kodik', 'external_id' => 'movie-1', 'translation' => 'Дубляж', 'link' => 'https://kodik.info/video/movie-1/old/720p']);
        $source->movie()->associate($movie)->save();
        $custom = new MovieSource(['provider' => 'custom', 'external_id' => 'own', 'link' => 'https://example.com/player']);
        $custom->movie()->associate($movie)->save();

        return $movie;
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.kodik.api_url' => 'https://kodik-api.com', 'services.kodik.token' => null]);
        app(SiteSettings::class)->putSecret('kodik_token', 'kodik-token');
        $this->results = [$this->item('movie-1', 'Дубляж', 'new'), $this->item('movie-2', 'LostFilm')];
        Http::fake(['kodik-api.com/search*' => function (Request $request) {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $q);

            return Http::response(['results' => isset($q['shikimori_id']) && $this->shikimori !== null ? $this->shikimori : $this->results]);
        }]);
    }

    public function test_admin_starts_bulk_and_add_only_keeps_existing_players(): void
    {
        Queue::fake();
        $movie = $this->movie();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post('/admin/cinema/players/bulk', ['replace' => false])->assertRedirect();
        Queue::assertPushed(AssignCinemaPlayers::class);

        $bulk = app(BulkPlayers::class);
        $this->assertTrue($bulk->running());
        $this->assertFalse($bulk->step());

        $this->assertSame('https://kodik.info/video/movie-1/old/720p', $movie->sources()->where('external_id', 'movie-1')->value('link'));
        $this->assertSame(['Дубляж', null, 'LostFilm'], $movie->sources()->orderBy('id')->pluck('translation')->all());

        $state = $bulk->state();
        $this->assertSame('finished', $state['status']);
        $this->assertSame(1, $state['added']);
        $this->assertSame(0, $state['replaced']);
        $this->assertSame(['kodik' => ['added' => 1, 'replaced' => 0, 'removed' => 0]], $state['report'][0]['providers']);
        $this->assertSame('Матриця', $state['report'][0]['title']);
    }

    public function test_replace_updates_existing_links_and_reports_them(): void
    {
        Queue::fake();
        $movie = $this->movie();
        $bulk = app(BulkPlayers::class);

        $this->assertTrue($bulk->start(true, null, []));
        $this->assertFalse($bulk->start(true, null, []), 'друга проставка не стартує, поки йде перша');
        $bulk->step();

        $this->assertSame('https://kodik.info/video/movie-1/new/720p', $movie->sources()->where('external_id', 'movie-1')->value('link'));
        $this->assertTrue($movie->sources()->where('provider', 'custom')->exists(), 'власний плеєр не зачіпається');
        $state = $bulk->state();
        $this->assertSame(1, $state['replaced']);
        $this->assertSame(1, $state['changed']);
        $this->assertSame(['added' => 1, 'replaced' => 1, 'removed' => 0], $state['report'][0]['providers']['kodik']);

        // Повторна проставка без змін — нічого не замінено, звіт порожній.
        $bulk->start(true, null, []);
        $bulk->step();
        $this->assertSame(0, $bulk->state()['changed']);
        $this->assertSame([], $bulk->state()['report']);
    }

    public function test_empty_provider_answer_removes_nothing_and_cancel_stops(): void
    {
        Queue::fake();
        $this->results = [];
        $movie = $this->movie();
        $bulk = app(BulkPlayers::class);

        $bulk->start(true, null, []);
        $bulk->step();
        $this->assertSame(2, $movie->sources()->count());
        $this->assertSame(1, $bulk->state()['not_found']);

        $bulk->start(true, 'serial', []);
        $this->assertSame(0, $bulk->state()['total']);
        $bulk->cancel();
        $this->assertSame('cancelled', $bulk->state()['status']);
        $this->assertFalse($bulk->step());
    }

    public function test_opening_a_stale_title_adds_missing_voices_without_touching_existing(): void
    {
        $movie = $this->movie();
        $this->assertTrue(RefreshMoviePlayers::due($movie));

        (new RefreshMoviePlayers($movie->id))->handle(app(CinemaService::class));

        $this->assertSame(['Дубляж', null, 'LostFilm'], $movie->sources()->orderBy('id')->pluck('translation')->all());
        $this->assertSame('https://kodik.info/video/movie-1/old/720p', $movie->sources()->where('external_id', 'movie-1')->value('link'));
        $this->assertFalse(RefreshMoviePlayers::due($movie->fresh()));
    }

    public function test_kodik_voices_are_merged_from_every_id(): void
    {
        $this->results = [$this->item('movie-1', 'Дубляж')];
        $this->shikimori = [$this->item('anime-2', 'AniDub'), $this->item('movie-1', 'Дубляж')];
        $movie = Movie::query()->create(['slug' => 'bleach', 'type' => 'anime', 'title' => 'Бліч', 'kinopoisk_id' => '301', 'shikimori_id' => '269', 'is_published' => true]);

        $found = app(CinemaService::class)->fetchPlayers($movie, ['kodik'])['kodik'];

        $this->assertSame(['Дубляж', 'AniDub'], array_column($found, 'translation'));
    }

    public function test_kodik_ids_are_learned_from_results(): void
    {
        // У тайтлу лише Кінопошук; запис AniLibria в Kodik знає Shikimori — за ним знаходяться інші озвучки.
        $anilibria = [...$this->item('movie-1', 'AniLibria'), 'shikimori_id' => '269'];
        $this->results = [$anilibria];
        $this->shikimori = [$anilibria, [...$this->item('anime-2', 'AniDub'), 'kinopoisk_id' => null, 'shikimori_id' => '269']];
        $movie = Movie::query()->create(['slug' => 'bleach', 'type' => 'anime', 'title' => 'Бліч', 'kinopoisk_id' => '301', 'is_published' => true]);

        $found = app(CinemaService::class)->fetchPlayers($movie, ['kodik'])['kodik'];

        $this->assertSame(['AniLibria', 'AniDub'], array_column($found, 'translation'));
        $this->assertSame('269', $movie->fresh()->shikimori_id);
    }
}
