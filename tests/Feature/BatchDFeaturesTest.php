<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Playlist;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Шпалери, музика гри, економія трафіку. */
class BatchDFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private function game(): Game
    {
        return Game::query()->create([
            'slug' => 'apex', 'name' => 'Apex Legends', 'letter' => 'A', 'category' => 'pc', 'is_published' => true,
            'details' => [
                'artworks' => ['https://images.igdb.com/igdb/image/upload/t_1080p/art1.jpg'],
                'screenshots' => ['https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1.jpg', 'https://evil.example/x.jpg'],
            ],
        ]);
    }

    public function test_wallpapers_are_listed_and_downloaded_from_igdb_only(): void
    {
        Http::preventStrayRequests();
        Http::fake(['images.igdb.com/*' => Http::response('JPEGDATA', 200, ['Content-Type' => 'image/jpeg'])]);
        $this->game();
        $user = User::factory()->create();

        $this->actingAs($user)->get('/games/apex')->assertInertia(fn ($page) => $page->where('wallpapers', [
            'https://images.igdb.com/igdb/image/upload/t_1080p/art1.jpg',
            'https://images.igdb.com/igdb/image/upload/t_1080p/sc1.jpg',
        ]));
        $this->actingAs($user)->get('/games/apex/wallpapers/1')->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="apex-legends-2.jpg"');
        $this->actingAs($user)->get('/games/apex/wallpapers/2')->assertNotFound();
    }

    public function test_players_attach_own_public_playlists_to_game(): void
    {
        $game = $this->game();
        [$owner, $other] = User::factory()->count(2)->create();
        $public = new Playlist(['title' => 'Музика з Apex', 'is_public' => true]);
        $public->user_id = $owner->id;
        $public->tracks_count = 5;
        $public->save();
        $private = new Playlist(['title' => 'Моє', 'is_public' => false]);
        $private->user_id = $owner->id;
        $private->tracks_count = 3;
        $private->save();

        $this->actingAs($owner)->getJson('/games/apex/playlists/mine')->assertJsonCount(1, 'playlists');
        $this->actingAs($owner)->postJson('/games/apex/playlists', ['playlist_id' => $private->id])->assertUnprocessable();
        $this->actingAs($other)->postJson('/games/apex/playlists', ['playlist_id' => $public->id])->assertNotFound();
        $this->actingAs($owner)->postJson('/games/apex/playlists', ['playlist_id' => $public->id])->assertOk()
            ->assertJsonPath('playlists.0.title', 'Музика з Apex')->assertJsonPath('playlists.0.can_remove', true);

        $this->actingAs($other)->get('/games/apex')->assertInertia(fn ($page) => $page
            ->where('soundtracks.0.title', 'Музика з Apex')->where('soundtracks.0.can_remove', false));
        $this->actingAs($other)->deleteJson("/games/apex/playlists/{$public->id}")->assertForbidden();
        $this->actingAs($owner)->deleteJson("/games/apex/playlists/{$public->id}")->assertOk()->assertJsonCount(0, 'playlists');
        $this->assertSame(0, DB::table('game_playlists')->where('game_id', $game->id)->count());
    }

    public function test_data_saver_setting_is_shared(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn ($page) => $page->where('auth.user.data_saver', false));
        $this->actingAs($user)->patch('/settings/data-saver', ['data_saver' => true])->assertRedirect();
        $this->actingAs($user)->get('/feed')->assertInertia(fn ($page) => $page->where('auth.user.data_saver', true));
    }
}
