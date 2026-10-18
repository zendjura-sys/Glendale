<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\ListenParty;
use App\Models\ServerReview;
use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LyricsRepeatCompareTest extends TestCase
{
    use RefreshDatabase;

    private function track(User $owner, array $attributes = []): Track
    {
        return Track::query()->create([
            'user_id' => $owner->id,
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'duration' => 180,
            'path' => 'music/test.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
            ...$attributes,
        ]);
    }

    public function test_lyrics_are_saved_and_shown_only_when_the_catalog_has_them(): void
    {
        $owner = User::factory()->create();
        $reader = User::factory()->create();
        $track = $this->track($owner);

        $this->actingAs($reader)->patchJson(route('tracks.update', $track), [
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'lyrics' => 'чужий текст',
        ])->assertForbidden();

        $this->actingAs($owner)->patchJson(route('tracks.update', $track), [
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'lyrics' => "перший рядок\nдругий",
        ])->assertOk()->assertJsonPath('track.has_lyrics', true);

        $this->actingAs($reader)->getJson(route('tracks.lyrics', $track))
            ->assertOk()
            ->assertJsonPath('lyrics', "перший рядок\nдругий");

        $this->actingAs($owner)->patchJson(route('tracks.update', $track), [
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'lyrics' => '   ',
        ])->assertOk()->assertJsonPath('track.has_lyrics', false);

        $this->assertNull($track->fresh()->lyrics);
    }

    public function test_repeat_restarts_a_finished_track_and_a_host_can_still_skip(): void
    {
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $current = $this->track($host, ['title' => 'Current']);
        $queued = $this->track($host, ['title' => 'Next']);

        $this->actingAs($host)->postJson(route('listen.store'), ['track_id' => $current->id])->assertCreated();
        $party = ListenParty::query()->sole();
        $this->actingAs($guest)->getJson(route('listen.show', $party))->assertOk();

        $this->actingAs($guest)->postJson(route('listen.repeat', $party), ['repeat' => true])->assertForbidden();
        $this->actingAs($host)->postJson(route('listen.repeat', $party), ['repeat' => true])
            ->assertOk()
            ->assertJsonPath('state.repeat', true);

        $this->actingAs($guest)->postJson(route('listen.queue', $party), ['track_id' => $queued->id])->assertOk();
        $party->refresh()->update(['position' => 179, 'playing' => false]);

        $this->actingAs($guest)->postJson(route('listen.next', $party))
            ->assertOk()
            ->assertJsonPath('state.track.title', 'Current')
            ->assertJsonPath('state.position', 0)
            ->assertJsonPath('state.playing', true)
            ->assertJsonPath('queue.0.track.title', 'Next');

        $party->refresh()->update([
            'position' => 10,
            'playing' => true,
            'state_ms' => (int) floor(microtime(true) * 1000),
        ]);
        $this->actingAs($host)->postJson(route('listen.next', $party))
            ->assertOk()
            ->assertJsonPath('state.track.title', 'Next')
            ->assertJsonCount(0, 'queue');
    }

    public function test_two_published_servers_can_be_compared(): void
    {
        $this->withoutVite();
        $user = User::factory()->create();
        $alpha = GtaServer::query()->create([
            'slug' => 'alpha',
            'name' => 'Alpha RP',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
        $beta = GtaServer::query()->create([
            'slug' => 'beta',
            'name' => 'Beta RP',
            'platform' => 'mobile',
            'multiplayer' => 'launcher',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
        $alpha->forceFill(['players_online' => 40, 'players_max' => 100])->save();
        $beta->forceFill(['players_online' => 12])->save();
        GtaServer::query()->create([
            'slug' => 'hidden',
            'name' => 'Hidden RP',
            'platform' => 'pc',
            'multiplayer' => 'fivem',
            'status' => GtaServer::STATUS_PENDING,
            'origin' => 'suggested',
        ]);
        ServerReview::query()->create([
            'user_id' => $user->id,
            'gta_server_id' => $alpha->id,
            'stars' => 5,
            'body' => 'Так',
        ]);

        $this->actingAs($user)->get(route('servers.compare', ['a' => 'alpha', 'b' => 'beta']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('servers/compare')
                ->where('left.name', 'Alpha RP')
                ->where('left.players_online', 40)
                ->where('left.rating', 5)
                ->where('right.name', 'Beta RP')
                ->where('right.players_online', 12)
                ->where('right.rating', null)
                ->has('servers', 2));

        $this->actingAs($user)->get(route('servers.compare', ['a' => 'hidden', 'b' => 'beta']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('left', null)->where('right.name', 'Beta RP'));

        $this->actingAs($user)->get(route('servers.compare', ['a' => 'alpha', 'b' => 'alpha']))->assertStatus(422);
    }
}
