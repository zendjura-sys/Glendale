<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\Movie;
use App\Models\User;
use App\Models\WatchParty;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WatchPartyTest extends TestCase
{
    use RefreshDatabase;

    private Movie $movie;

    private User $host;

    private User $guest;

    protected function setUp(): void
    {
        parent::setUp();
        $this->movie = Movie::query()->create([
            'slug' => 'matrix-1999',
            'type' => 'movie',
            'title' => 'Матриця',
            'year' => 1999,
            'imdb_id' => 'tt0133093',
            'is_published' => true,
        ]);
        $this->movie->sources()->create(['provider' => 'kodik', 'external_id' => 'k1', 'link' => 'https://kodik.info/video/1/abc/720p', 'translation' => 'Дубляж']);
        $this->host = User::factory()->create();
        $this->guest = User::factory()->create();
    }

    private function party(): WatchParty
    {
        $this->actingAs($this->host)->postJson(route('cinema.watch.store', $this->movie), ['player_key' => 'kodik:1'])->assertCreated();

        return WatchParty::query()->sole();
    }

    public function test_host_creates_party_and_guest_joins_by_link(): void
    {
        $this->actingAs($this->host)->post(route('cinema.watch.store', $this->movie))->assertRedirect();
        $party = WatchParty::query()->sole();

        // Без посилання стан недоступний.
        $this->actingAs($this->guest)->getJson(route('watch.poll', $party))->assertForbidden();

        $this->actingAs($this->guest)->getJson(route('watch.show', $party))
            ->assertOk()
            ->assertJsonPath('movie.title', 'Матриця')
            ->assertJsonPath('party.is_host', false)
            ->assertJsonPath('party.can_control', false)
            ->assertJsonCount(2, 'party.members');
    }

    public function test_only_host_controls_playback_unless_shared(): void
    {
        $party = $this->party();
        $this->actingAs($this->guest)->getJson(route('watch.show', $party))->assertOk();

        $this->actingAs($this->guest)->postJson(route('watch.control', $party), ['playing' => true, 'position' => 10])->assertForbidden();

        $this->actingAs($this->host)->postJson(route('watch.control', $party), ['playing' => true, 'position' => 125.5])
            ->assertOk()
            ->assertJsonPath('state.playing', true)
            ->assertJsonPath('state.position', 125.5);

        $this->actingAs($this->host)->postJson(route('watch.shared', $party), ['shared' => true])->assertOk();
        $this->actingAs($this->guest)->postJson(route('watch.control', $party), ['playing' => false, 'position' => 130])
            ->assertOk()
            ->assertJsonPath('state.playing', false);
    }

    public function test_chat_and_new_messages_since_last_poll(): void
    {
        $party = $this->party();
        $this->actingAs($this->guest)->getJson(route('watch.show', $party));

        $first = $this->actingAs($this->guest)->postJson(route('watch.messages', $party), ['body' => 'Привіт!'])->assertCreated()->json('id');
        $this->actingAs($this->host)->postJson(route('watch.messages', $party), ['body' => 'Починаємо'])->assertCreated();

        $this->actingAs($this->guest)->getJson(route('watch.poll', $party).'?after='.$first)
            ->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.body', 'Починаємо');
    }

    public function test_host_invites_friends_through_messenger_and_ends_party(): void
    {
        $friendships = app(FriendshipService::class);
        $friendships->request($this->host, $this->guest);
        $friendships->accept($this->guest, $this->host);
        $party = $this->party();

        $this->actingAs($this->host)->postJson(route('watch.invite', $party), ['user_ids' => [$this->guest->id]])
            ->assertOk()
            ->assertJsonPath('sent', 1);
        $this->assertStringContainsString('/watch/'.$party->code, (string) Message::query()->latest('id')->value('body'));

        $this->actingAs($this->guest)->getJson(route('watch.show', $party));
        $this->actingAs($this->guest)->deleteJson(route('watch.end', $party))->assertForbidden();
        $this->actingAs($this->host)->deleteJson(route('watch.end', $party))->assertOk();
        $this->actingAs($this->guest)->postJson(route('watch.messages', $party), ['body' => 'Ще тут?'])->assertStatus(410);
    }
}
