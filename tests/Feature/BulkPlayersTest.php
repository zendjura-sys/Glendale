<?php

namespace Tests\Feature;

use App\Jobs\AssignCinemaPlayers;
use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use App\Services\Cinema\BulkPlayers;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Масова проставка плеєрів: «лише нові» не чіпає наявні, «замінити» оновлює; звіт — що змінено. */
class BulkPlayersTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<array<string, mixed>> */
    private array $results = [];

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
        Http::fake(['kodik-api.com/search*' => fn () => Http::response(['results' => $this->results])]);
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
}
