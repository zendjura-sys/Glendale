<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Плитки бічного меню «Музики» (ПК): топ GameCon на перших чотирьох, решта — з медіатеки. */
class MusicMenuCoversTest extends TestCase
{
    use RefreshDatabase;

    private function track(string $title, array $attributes = []): Track
    {
        return Track::query()->create([
            'user_id' => null, 'title' => $title, 'artist' => 'Nightdrive', 'album' => 'Midnight Run', 'genre' => 'Synthwave',
            'duration' => 180, 'path' => 'music/'.md5($title).'.mp3', 'mime' => 'audio/mpeg', 'size' => 1,
            'cover_path' => 'covers/'.md5($title).'.jpg',
            ...$attributes,
        ]);
    }

    public function test_top_tiles_follow_gamecon_chart_and_library_tiles_use_own_music(): void
    {
        $user = User::factory()->create();
        $listener = User::factory()->create();
        $hit = $this->track('Хіт', ['artist' => 'Vira Echo']);
        $second = $this->track('Другий');
        $mine = $this->track('Моя', ['album' => 'Own Album']);
        foreach ([$user, $listener] as $who) {
            DB::table('music_plays')->insert(['user_id' => $who->id, 'track_id' => $hit->id, 'title' => 'Хіт', 'artist' => 'Vira Echo', 'played_at' => now()->subHour()]);
        }
        DB::table('music_plays')->insert(['user_id' => $listener->id, 'track_id' => $second->id, 'title' => 'Другий', 'artist' => 'Nightdrive', 'played_at' => now()->subHour()]);
        DB::table('music_plays')->insert(['user_id' => $user->id, 'track_id' => $mine->id, 'title' => 'Моя', 'artist' => 'Nightdrive', 'cover_url' => 'https://cdn.test/last.jpg', 'played_at' => now()]);
        DB::table('music_library')->insert(['user_id' => $user->id, 'track_id' => $mine->id, 'is_favorite' => true, 'created_at' => now()]);

        $json = $this->actingAs($user)->getJson('/music/menu-covers')->assertOk()->json();

        $this->assertSame('Хіт', $json['top'][0]['title']);
        $this->assertSame(Storage::disk('public')->url($hit->cover_path), $json['top'][0]['cover_url']);
        $this->assertSame('Другий', $json['top'][1]['title']);
        $this->assertLessThanOrEqual(4, count($json['top']));
        $this->assertSame('https://cdn.test/last.jpg', $json['tiles']['recent']);
        $this->assertSame($mine->cover_url, $json['tiles']['favorites']);
        $this->assertSame($mine->cover_url, $json['tiles']['albums']);
        $this->assertNotNull($json['tiles']['rooms']);
    }

    public function test_empty_library_gives_empty_tiles(): void
    {
        $user = User::factory()->create();

        $json = $this->actingAs($user)->getJson('/music/menu-covers')->assertOk()->json();

        $this->assertSame([], $json['top']);
        $this->assertNull($json['tiles']['recent']);
        $this->assertNull($json['tiles']['favorites']);
    }
}
