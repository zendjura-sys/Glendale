<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\RadioStation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Mockery;
use Tests\TestCase;

/** Адмінка музики: радіостанції й добірки редакції; кожна дія — у журналі. */
class AdminMusicRadioTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Нові сторінки ще не зібрані у Vite-маніфест.
        $this->withoutVite();
    }

    private function assertLogged(string $message): void
    {
        Log::shouldHaveReceived('info')->with($message, Mockery::on(fn (array $context) => isset($context['by'])))->atLeast()->once();
    }

    public function test_non_admin_cannot_manage_music(): void
    {
        $user = User::factory()->create();
        $station = RadioStation::query()->create(['name' => 'FM', 'slug' => 'fm', 'stream_url' => 'https://example.com/live']);

        $this->actingAs($user)->get('/admin/music/radio')->assertForbidden();
        $this->actingAs($user)->post('/admin/music/radio', ['name' => 'X', 'stream_url' => 'https://example.com/a'])->assertForbidden();
        $this->actingAs($user)->delete("/admin/music/radio/{$station->id}")->assertForbidden();
        $this->actingAs($user)->get('/admin/music/featured')->assertForbidden();
        $this->assertDatabaseHas('radio_stations', ['id' => $station->id]);
    }

    public function test_admin_creates_updates_and_deletes_station(): void
    {
        Storage::fake('public');
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/admin/music/radio')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('admin/music-radio'));
        Log::spy();

        $this->actingAs($admin)->post('/admin/music/radio', [
            'name' => 'Нічне Радіо',
            'tagline' => 'Синтвейв цілодобово',
            'stream_url' => 'https://stream.example.com/night.mp3',
            'genre' => 'Synthwave',
            'country' => 'ua',
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
        ])->assertRedirect()->assertSessionHasNoErrors();

        $station = RadioStation::query()->firstOrFail();
        $this->assertSame('nichne-radio', $station->slug);
        $this->assertSame('UA', $station->country);
        $this->assertTrue($station->is_active);
        $this->assertNotNull($station->logo_path);
        Storage::disk('public')->assertExists((string) $station->logo_path);
        $this->assertLogged('music: radio station created');

        $this->actingAs($admin)->get('/music/radio')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('data.live.0.title', 'Нічне Радіо')
            ->where('data.by_genre.0.genre', 'Synthwave'));

        $old = (string) $station->logo_path;
        $this->actingAs($admin)->post("/admin/music/radio/{$station->id}", [
            'name' => 'Нічне Радіо 2',
            'stream_url' => 'https://stream.example.com/night2.mp3',
            'logo_url' => 'https://cdn.example.com/logo.png',
        ])->assertRedirect()->assertSessionHasNoErrors();
        $station->refresh();
        $this->assertSame('Нічне Радіо 2', $station->name);
        $this->assertSame('nichne-radio', $station->slug);
        $this->assertSame('https://cdn.example.com/logo.png', $station->logo_url);
        Storage::disk('public')->assertMissing($old);
        $this->assertLogged('music: radio station updated');

        $this->actingAs($admin)->patch("/admin/music/radio/{$station->id}/flags", ['is_active' => false])->assertRedirect();
        $this->assertFalse($station->refresh()->is_active);
        $this->assertLogged('music: radio station flags');
        $this->actingAs($admin)->get('/music/radio')->assertInertia(fn (AssertableInertia $page) => $page->where('data.live', []));

        $this->actingAs($admin)->delete("/admin/music/radio/{$station->id}")->assertRedirect();
        $this->assertDatabaseMissing('radio_stations', ['id' => $station->id]);
        $this->assertLogged('music: radio station deleted');
    }

    public function test_stream_must_be_https(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post('/admin/music/radio', ['name' => 'Старе FM', 'stream_url' => 'http://example.com/live.mp3'])
            ->assertSessionHasErrors('stream_url');
        $this->assertDatabaseCount('radio_stations', 0);
    }

    public function test_reorder_stations(): void
    {
        $admin = User::factory()->admin()->create();
        $a = RadioStation::query()->create(['name' => 'A', 'slug' => 'a', 'stream_url' => 'https://example.com/a', 'position' => 1]);
        $b = RadioStation::query()->create(['name' => 'B', 'slug' => 'b', 'stream_url' => 'https://example.com/b', 'position' => 2]);

        $this->actingAs($admin)->patch("/admin/music/radio/{$b->id}/flags", ['move' => 'up'])->assertRedirect();

        $this->assertLessThan($a->refresh()->position, $b->refresh()->position);
    }

    public function test_probe_reports_stream_status(): void
    {
        Log::spy();
        Http::fake(['https://93.184.215.14/*' => Http::response('', 200, ['Content-Type' => 'audio/mpeg'])]);
        $admin = User::factory()->admin()->create();
        $station = RadioStation::query()->create(['name' => 'FM', 'slug' => 'fm', 'stream_url' => 'https://93.184.215.14/live']);
        $local = RadioStation::query()->create(['name' => 'Local', 'slug' => 'local', 'stream_url' => 'https://127.0.0.1/live']);

        $this->actingAs($admin)->post("/admin/music/radio/{$station->id}/probe")->assertRedirect();
        $this->assertSame('success', session('inertia.flash_data.toast.type'));
        $this->assertStringContainsString('audio/mpeg', (string) session('inertia.flash_data.toast.message'));
        $this->assertLogged('music: radio stream checked');

        // Внутрішні адреси не перевіряємо — запит не йде.
        $this->actingAs($admin)->post("/admin/music/radio/{$local->id}/probe")->assertRedirect();
        $this->assertSame('error', session('inertia.flash_data.toast.type'));
        Http::assertSentCount(1);
    }

    public function test_admin_features_playlist_with_category(): void
    {
        Log::spy();
        $admin = User::factory()->admin()->create();
        $owner = User::factory()->create();
        $playlist = Playlist::query()->forceCreate(['user_id' => $owner->id, 'title' => 'Нічна дорога', 'is_public' => true]);
        $private = Playlist::query()->forceCreate(['user_id' => $owner->id, 'title' => 'Секрет', 'is_public' => false]);

        $this->actingAs($admin)->get('/admin/music/featured?q=Нічна')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('admin/music-featured')
            ->where('results.0.id', $playlist->id));

        $this->actingAs($admin)->patch("/admin/music/featured/{$playlist->id}", ['is_featured' => true, 'category' => 'road'])
            ->assertRedirect()->assertSessionHasNoErrors();
        $this->assertLogged('music: playlist featured');

        $this->actingAs($admin)->get('/music/new')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('data.moods.0.category', 'road')
            ->where('data.moods.0.playlists.0.id', $playlist->id));
        $this->actingAs($admin)->get('/admin/music/featured')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('groups.0.category', 'road')
            ->where('groups.0.playlists.0.id', $playlist->id));

        $this->actingAs($admin)->patch("/admin/music/featured/{$playlist->id}", ['is_featured' => true, 'category' => 'nope'])
            ->assertSessionHasErrors('category');
        $this->actingAs($admin)->patch("/admin/music/featured/{$private->id}", ['is_featured' => true])
            ->assertSessionHasErrors('is_featured');

        $this->actingAs($admin)->patch("/admin/music/featured/{$playlist->id}", ['is_featured' => false])->assertRedirect();
        $this->assertDatabaseHas('playlists', ['id' => $playlist->id, 'is_featured' => false, 'category' => null]);
        $this->actingAs($admin)->get('/music/new')->assertInertia(fn (AssertableInertia $page) => $page->where('data.moods', []));
    }
}
