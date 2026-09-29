<?php

namespace Tests\Feature;

use App\Cinema\{AttachPlayerJob, BulkAttachPlayersJob, CinemaActivity, CinemaSettings, FlixCdn, Kodik, Title};
use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http, Queue};
use Tests\TestCase;

class CinemaOperationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'private-test-token');
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'private-flix-token');
    }

    private function admin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');
        return $user;
    }

    public function test_bulk_processing_includes_existing_players_and_more_than_500_titles(): void
    {
        Queue::fake();
        for ($i = 1; $i <= 505; $i++) {
            Title::create(['tmdb_id' => $i, 'type' => 'movie', 'name' => "Тайтл {$i}", 'kodik_link' => 'https://old.example/embed']);
        }
        $admin = $this->admin();
        $this->actingAs($admin)->post('/admin/cinema/bulk-attach-players', ['source' => 'kodik'])
            ->assertRedirect()->assertSessionHasNoErrors();
        Queue::assertPushed(BulkAttachPlayersJob::class, 1);
        $pending = [Queue::pushed(BulkAttachPlayersJob::class)->first()['job']];
        // Execute real page coordinators; external worker delivery is the only fake.
        while ($job = array_shift($pending)) {
            Queue::fake();
            $job->handle();
            foreach (Queue::pushed(AttachPlayerJob::class) as $entry) {
                $ids[] = $entry['job']->titleId;
                $this->assertTrue($entry['job']->replace);
                $this->assertSame($admin->id, $entry['job']->actorId);
            }
            foreach (Queue::pushed(BulkAttachPlayersJob::class) as $entry) $pending[] = $entry['job'];
        }
        $this->assertCount(505, array_unique($ids));
    }

    public function test_successful_refresh_replaces_existing_player_and_is_logged(): void
    {
        $title = Title::create(['tmdb_id' => 1, 'type' => 'movie', 'name' => 'Фільм', 'kodik_link' => 'https://old.example']);
        Http::fake(['kodik-api.com/*' => Http::response(['results' => [
            ['type' => 'foreign-movie', 'link' => '//kodik.info/new', 'translation' => ['title' => 'Українська']],
        ]])]);
        Kodik::attach($title, replace: true);
        $this->assertSame('https://kodik.info/new', $title->fresh()->kodik_link);
        $this->assertDatabaseHas('cinema_activity_logs', ['title_id' => $title->id, 'source' => 'kodik', 'status' => 'success']);
    }

    public function test_authoritative_no_match_clears_old_player_but_default_lookup_preserves_it(): void
    {
        $title = Title::create(['tmdb_id' => 2, 'type' => 'movie', 'name' => 'Фільм', 'kodik_link' => 'https://old.example', 'kodik_translations' => [['link' => 'https://old.example']]]);
        Http::fake(['kodik-api.com/*' => Http::response(['results' => []])]);
        Kodik::attach($title);
        $this->assertSame('https://old.example', $title->fresh()->kodik_link);
        Kodik::attach($title, replace: true);
        $this->assertNull($title->fresh()->kodik_link);
        $this->assertSame([], $title->fresh()->kodik_translations);
        $this->assertDatabaseHas('cinema_activity_logs', ['title_id' => $title->id, 'status' => 'not_found']);
    }

    public function test_provider_error_preserves_player_logs_safe_error_and_allows_job_retry(): void
    {
        $title = Title::create(['tmdb_id' => 3, 'type' => 'movie', 'name' => 'Фільм', 'kodik_link' => 'https://old.example']);
        Http::fake(['kodik-api.com/*' => Http::response(['error' => 'private-test-token'], 503)]);
        try {
            (new AttachPlayerJob('kodik', $title->id, true))->handle();
            $this->fail('A provider outage must reach the queue retry mechanism.');
        } catch (\App\Cinema\PlayerLookupException $e) {
            $this->assertStringNotContainsString('private-test-token', $e->getMessage());
        }
        $this->assertSame('https://old.example', $title->fresh()->kodik_link);
        $log = CinemaActivity::latest('id')->firstOrFail();
        $this->assertSame('error', $log->status);
        $this->assertStringNotContainsString('private-test-token', $log->toJson());
    }

    public function test_flixcdn_no_match_clears_binding_but_malformed_response_does_not(): void
    {
        $title = Title::create(['tmdb_id' => 4, 'type' => 'movie', 'name' => 'Фільм', 'flixcdn_link' => 'https://old.example']);
        Http::fake(['api0.uacdn.live/*' => Http::response(['unexpected' => true])]);
        try { FlixCdn::attach($title, replace: true); } catch (\App\Cinema\PlayerLookupException) {}
        $this->assertSame('https://old.example', $title->fresh()->flixcdn_link);
        Http::fake(['api0.uacdn.live/*' => Http::response(['result' => []])]);
        FlixCdn::attach($title, replace: true);
        $this->assertNull($title->fresh()->flixcdn_link);
    }

    public function test_activity_is_protected_filterable_and_survives_title_deletion(): void
    {
        $title = Title::create(['tmdb_id' => 5, 'type' => 'movie', 'name' => 'Журнал']);
        $this->actingAs(User::factory()->create())->getJson('/admin/cinema/activity')->assertForbidden();
        $admin = $this->admin();
        $this->actingAs($admin)->patch("/admin/cinema/titles/{$title->id}", ['published' => false])->assertRedirect();
        $this->assertDatabaseHas('cinema_activity_logs', ['operation' => 'update', 'actor_id' => $admin->id, 'title_id' => $title->id]);
        $this->delete("/admin/cinema/titles/{$title->id}")->assertRedirect();
        $this->getJson('/admin/cinema/activity?operation=destroy')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title_name', 'Журнал');
    }
}
