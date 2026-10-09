<?php

namespace Tests\Feature;

use App\Models\ListenParty;
use App\Models\Message;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListenPartyTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private User $guest;

    protected function setUp(): void
    {
        parent::setUp();
        $this->host = User::factory()->create();
        $this->guest = User::factory()->create();
    }

    private function track(string $title, int $duration = 180): Track
    {
        return Track::query()->create([
            'title' => $title,
            'artist' => 'Nightdrive Kyiv',
            'duration' => $duration,
            'path' => 'music/'.$title.'.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
        ]);
    }

    private function party(?Track $track = null): ListenParty
    {
        $this->actingAs($this->host)->postJson(route('listen.store'), ['track_id' => $track?->id])->assertCreated();
        $party = ListenParty::query()->sole();
        $this->actingAs($this->guest)->getJson(route('listen.show', $party))->assertOk();

        return $party;
    }

    private function friends(): void
    {
        $friendships = app(FriendshipService::class);
        $friendships->request($this->host, $this->guest);
        $friendships->accept($this->guest, $this->host);
    }

    public function test_guest_joins_by_link_and_sees_current_track(): void
    {
        $first = $this->track('Neon Skyline');
        $this->actingAs($this->host)->post(route('listen.store'), ['track_id' => $first->id])->assertRedirect();
        $party = ListenParty::query()->sole();

        // Без посилання стан недоступний.
        $this->actingAs($this->guest)->getJson(route('listen.poll', $party))->assertForbidden();

        $this->actingAs($this->guest)->getJson(route('listen.show', $party))
            ->assertOk()
            ->assertJsonPath('party.state.track.title', 'Neon Skyline')
            ->assertJsonPath('party.state.playing', true)
            ->assertJsonPath('party.is_host', false)
            ->assertJsonPath('party.can_control', false)
            ->assertJsonCount(2, 'party.members');
    }

    public function test_only_host_controls_playback_unless_shared(): void
    {
        $party = $this->party($this->track('Neon Skyline'));
        $other = $this->track('Second');

        $this->actingAs($this->guest)->postJson(route('listen.control', $party), ['playing' => false, 'position' => 10])->assertForbidden();

        $this->actingAs($this->host)->postJson(route('listen.control', $party), ['playing' => true, 'position' => 42.5, 'track_id' => $other->id])
            ->assertOk()
            ->assertJsonPath('state.track.title', 'Second')
            ->assertJsonPath('state.position', 42.5);

        $this->actingAs($this->host)->postJson(route('listen.shared', $party), ['shared' => true])->assertOk();
        $this->actingAs($this->guest)->postJson(route('listen.control', $party), ['playing' => false, 'position' => 50])
            ->assertOk()
            ->assertJsonPath('state.playing', false);
    }

    public function test_everyone_adds_to_shared_queue_and_next_takes_from_it(): void
    {
        $party = $this->party();
        $a = $this->track('A');
        $b = $this->track('B');
        $c = $this->track('C');

        // Порожня кімната: перший доданий трек одразу грає.
        $this->actingAs($this->guest)->postJson(route('listen.queue', $party), ['track_id' => $a->id])
            ->assertOk()
            ->assertJsonPath('state.track.title', 'A')
            ->assertJsonCount(0, 'queue');
        $this->actingAs($this->guest)->postJson(route('listen.queue', $party), ['track_id' => $b->id])->assertOk();
        $this->actingAs($this->host)->postJson(route('listen.queue', $party), ['track_id' => $c->id])
            ->assertJsonCount(2, 'queue')
            ->assertJsonPath('queue.0.by.id', $this->guest->id);

        // Гість не прибирає чужий трек і не перемикає, поки трек не дограв.
        $this->actingAs($this->guest)->deleteJson(route('listen.dequeue', [$party, 1]))->assertForbidden();
        $this->actingAs($this->guest)->postJson(route('listen.next', $party))->assertForbidden();

        $this->actingAs($this->host)->postJson(route('listen.next', $party))
            ->assertOk()
            ->assertJsonPath('state.track.title', 'B')
            ->assertJsonPath('queue.0.track.title', 'C');

        // Трек дограв (ведучий відійшов) — гість може перемкнути, щоб музика не зупинилася.
        $party->refresh()->update(['position' => 179, 'playing' => false]);
        $this->actingAs($this->guest)->postJson(route('listen.next', $party))->assertOk()->assertJsonPath('state.track.title', 'C');
        $this->actingAs($this->host)->postJson(route('listen.next', $party))->assertOk()->assertJsonPath('state.track', null)->assertJsonPath('state.playing', false);
    }

    public function test_host_invites_friends_and_calls_group_chat_then_ends(): void
    {
        $this->friends();
        $track = $this->track('Neon Skyline');
        $group = app(Messenger::class)->createGroup($this->host, 'Сім’я', [$this->guest->id]);
        $this->actingAs($this->host)->postJson(route('listen.store'), ['track_id' => $track->id, 'conversation_id' => $group->id])->assertCreated();
        $party = ListenParty::query()->sole();
        $this->assertStringContainsString('/listen/'.$party->code, (string) Message::query()->where('conversation_id', $group->id)->latest('id')->value('body'));

        $this->actingAs($this->host)->postJson(route('listen.invite', $party), ['user_ids' => [$this->guest->id]])->assertOk()->assertJsonPath('sent', 1);

        // Чужий у групі не може кликати туди.
        $stranger = User::factory()->create();
        $this->actingAs($stranger)->getJson(route('listen.show', $party))->assertOk();
        $this->actingAs($stranger)->postJson(route('listen.share', $party), ['conversation_id' => $group->id])->assertForbidden();

        $this->actingAs($this->guest)->getJson(route('listen.show', $party));
        $this->actingAs($this->guest)->deleteJson(route('listen.end', $party))->assertForbidden();
        $this->actingAs($this->host)->deleteJson(route('listen.end', $party))->assertOk();
        $this->actingAs($this->guest)->postJson(route('listen.queue', $party), ['track_id' => $track->id])->assertStatus(410);
    }
}
