<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\ListenParty;
use App\Models\ListenPartyMember;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Notifications\ListenRoomStarted;
use App\Services\Auth\ApiTokens;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** Кімнати «Слухати разом» для групи: діджей, пропозиції, реакції, чат, права, автозавершення. */
class ListenRoomsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $member;

    private User $stranger;

    private Community $community;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        $this->member = User::factory()->create();
        $this->stranger = User::factory()->create();
        $this->community = app(CommunityService::class)->create($this->owner, [
            'name' => 'Нічні гонщики', 'type' => Community::TYPE_PUBLIC, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_CLOSED, 'category' => 'games',
        ]);
        $this->community->memberships()->create(['user_id' => $this->member->id, 'role' => CommunityMember::ROLE_MEMBER, 'status' => CommunityMember::STATUS_ACTIVE]);
    }

    private function track(string $title, int $duration = 180): Track
    {
        return Track::query()->create(['title' => $title, 'artist' => 'Nightdrive Kyiv', 'duration' => $duration, 'path' => 'music/'.$title.'.mp3', 'mime' => 'audio/mpeg', 'size' => 1000]);
    }

    private function start(User $user, array $extra = []): ListenParty
    {
        $this->actingAs($user)->postJson(route('music.rooms.store'), ['group_type' => 'community', 'group_id' => $this->community->id, ...$extra])->assertCreated();

        return ListenParty::query()->latest('id')->firstOrFail();
    }

    public function test_member_starts_room_others_join_and_see_live_badge(): void
    {
        Notification::fake();
        $room = $this->start($this->member, ['title' => 'Вечір синтвейву', 'track_id' => $this->track('Neon')->id]);
        $this->assertTrue($room->moderated);
        $this->assertSame('community', $room->group_type);
        Notification::assertSentTo($this->owner, ListenRoomStarted::class);
        Notification::assertNotSentTo($this->member, ListenRoomStarted::class);

        // Сторонній до кімнати групи не потрапить навіть за посиланням.
        $this->actingAs($this->stranger)->getJson(route('listen.show', $room))->assertForbidden();
        $this->actingAs($this->stranger)->getJson(route('music.rooms.group', ['community', $this->community->id]))
            ->assertOk()->assertJsonPath('member', false)->assertJsonPath('room', null);

        $this->actingAs($this->owner)->getJson(route('listen.show', $room))
            ->assertOk()->assertJsonPath('party.room.group.name', 'Нічні гонщики')
            ->assertJsonPath('party.room.can_manage', true)
            ->assertJsonPath('party.state.track.title', 'Neon');
        $this->actingAs($this->owner)->getJson(route('music.rooms.group', ['community', $this->community->id]))
            ->assertOk()->assertJsonPath('room.code', $room->code)->assertJsonPath('room.listeners', 2);

        // Друга спроба відкрити кімнату в групі приєднує до живої; повторного сповіщення немає.
        $this->assertSame($room->id, $this->start($this->owner)->id);
        $this->assertSame(1, ListenParty::query()->count());

        $this->actingAs($this->member)->getJson(route('music.rooms'))->assertOk()->assertJsonPath('rooms.0.code', $room->code)->assertJsonPath('groups.0.can_start', true);
    }

    public function test_dj_controls_others_suggest_and_dj_approves(): void
    {
        $room = $this->start($this->owner, ['track_id' => $this->track('Neon')->id]);
        $this->actingAs($this->member)->getJson(route('listen.show', $room))->assertOk();
        $b = $this->track('B');

        // Слухач не керує плеєром.
        $this->actingAs($this->member)->postJson(route('listen.control', $room), ['playing' => false, 'position' => 10])->assertForbidden();
        $this->actingAs($this->member)->postJson(route('listen.next', $room))->assertForbidden();
        $this->actingAs($this->owner)->postJson(route('listen.control', $room), ['playing' => true, 'position' => 30])->assertOk()->assertJsonPath('state.position', 30);

        // Додати в чергу слухач не може — лише запропонувати (і через старий маршрут черги теж).
        $this->actingAs($this->member)->postJson(route('listen.suggest', $room), ['track_id' => $b->id])
            ->assertOk()->assertJsonCount(0, 'queue')->assertJsonPath('room.suggestions.0.track.title', 'B');
        $this->actingAs($this->member)->postJson(route('listen.queue', $room), ['track_id' => $b->id])->assertUnprocessable();
        $this->actingAs($this->member)->postJson(route('listen.review', [$room, 0]), ['approve' => true])->assertForbidden();

        $this->actingAs($this->owner)->postJson(route('listen.review', [$room, 0]), ['approve' => true])
            ->assertOk()->assertJsonCount(0, 'room.suggestions')
            ->assertJsonPath('queue.0.track.title', 'B')
            ->assertJsonPath('queue.0.by.id', $this->member->id);

        // Радіостанція теж синхронізується — як картка з duration 0.
        $station = RadioStation::query()->create(['name' => 'Kyiv FM', 'slug' => 'kyiv-fm', 'stream_url' => 'https://example.com/live']);
        $this->actingAs($this->owner)->postJson(route('listen.control', $room), ['playing' => true, 'position' => 0, 'station_id' => $station->id])
            ->assertOk()->assertJsonPath('state.track.key', 'radio:'.$station->id);
        // Радіо не «дограє» — слухач не перемикає.
        $this->actingAs($this->member)->postJson(route('listen.next', $room))->assertForbidden();
    }

    public function test_reactions_chat_pass_dj_and_kick(): void
    {
        $room = $this->start($this->owner);
        $this->actingAs($this->member)->getJson(route('listen.show', $room))->assertOk();

        $this->actingAs($this->member)->postJson(route('listen.react', $room), ['emoji' => '🔥'])->assertOk()->assertJsonPath('reaction.emoji', '🔥');
        $this->actingAs($this->member)->postJson(route('listen.react', $room), ['emoji' => 'nope'])->assertUnprocessable();
        $this->actingAs($this->member)->postJson(route('listen.chat', $room), ['body' => 'Класний трек!'])->assertCreated();
        $this->actingAs($this->owner)->getJson(route('listen.poll', $room))
            ->assertOk()->assertJsonPath('room.messages.0.body', 'Класний трек!')->assertJsonPath('room.reactions.0.emoji', '🔥');

        // Слухач не передає роль і не прибирає інших.
        $this->actingAs($this->member)->postJson(route('listen.host', $room), ['user_id' => $this->member->id])->assertForbidden();
        $this->actingAs($this->owner)->postJson(route('listen.host', $room), ['user_id' => $this->stranger->id])->assertUnprocessable();
        $this->actingAs($this->owner)->postJson(route('listen.host', $room), ['user_id' => $this->member->id])->assertOk();
        $this->actingAs($this->member)->getJson(route('listen.poll', $room))->assertJsonPath('is_host', true)->assertJsonPath('can_control', true);

        // Адміністратор групи може прибрати слухача; той більше не повернеться.
        $third = User::factory()->create();
        $this->community->memberships()->create(['user_id' => $third->id, 'role' => CommunityMember::ROLE_MEMBER, 'status' => CommunityMember::STATUS_ACTIVE]);
        $this->actingAs($third)->getJson(route('listen.show', $room))->assertOk();
        $this->actingAs($third)->postJson(route('listen.kick', $room), ['user_id' => $this->owner->id])->assertForbidden();
        $this->actingAs($this->owner)->postJson(route('listen.kick', $room), ['user_id' => $third->id])->assertOk();
        $this->actingAs($third)->getJson(route('listen.show', $room))->assertForbidden();
        $this->actingAs($third)->getJson(route('listen.poll', $room))->assertForbidden();

        // Завершити: діджей або адміністратор групи.
        $this->actingAs($this->owner)->deleteJson(route('listen.end', $room))->assertOk();
        $this->actingAs($this->member)->postJson(route('listen.chat', $room), ['body' => 'Ще тут?'])->assertStatus(410);
    }

    public function test_admins_restrict_who_starts_rooms(): void
    {
        $this->actingAs($this->member)->putJson(route('music.rooms.policy', ['community', $this->community->id]), ['who' => 'admins'])->assertForbidden();
        $this->actingAs($this->owner)->putJson(route('music.rooms.policy', ['community', $this->community->id]), ['who' => 'admins'])
            ->assertOk()->assertJsonPath('policy', 'admins');

        $this->actingAs($this->member)->postJson(route('music.rooms.store'), ['group_type' => 'community', 'group_id' => $this->community->id])->assertForbidden();
        $this->actingAs($this->stranger)->postJson(route('music.rooms.store'), ['group_type' => 'community', 'group_id' => $this->community->id])->assertForbidden();
        $this->actingAs($this->owner)->postJson(route('music.rooms.store'), ['group_type' => 'community', 'group_id' => $this->community->id])->assertCreated();

        $this->actingAs($this->owner)->putJson(route('music.rooms.policy', ['community', $this->community->id]), ['who' => 'off'])->assertOk();
        ListenParty::query()->update(['ended_at' => now()]);
        $this->actingAs($this->owner)->postJson(route('music.rooms.store'), ['group_type' => 'community', 'group_id' => $this->community->id])->assertForbidden();
        $this->actingAs($this->owner)->getJson(route('music.rooms.group', ['community', $this->community->id]))->assertJsonPath('can_start', false);
    }

    public function test_room_auto_ends_after_ten_minutes_without_listeners(): void
    {
        $room = $this->start($this->owner);
        $this->travel(5)->minutes();
        $this->artisan('listen:sweep')->assertSuccessful();
        $this->assertNull($room->refresh()->ended_at);

        // Хтось слухає — кімната жива.
        $this->travel(4)->minutes();
        ListenPartyMember::query()->where('listen_party_id', $room->id)->update(['last_seen_at' => now()]);
        $this->travel(7)->minutes();
        $this->artisan('listen:sweep')->assertSuccessful();
        $this->assertNull($room->refresh()->ended_at);

        $this->travel(4)->minutes();
        $this->artisan('listen:sweep')->assertSuccessful();
        $this->assertNotNull($room->refresh()->ended_at);
    }

    public function test_app_opens_rooms_through_bridge(): void
    {
        $token = app(ApiTokens::class)->issue($this->member, 'android');
        $this->withToken($token)->getJson('/api/v1/site/music/rooms')->assertOk()->assertJsonStructure(['rooms', 'groups', 'stations']);
        $code = $this->withToken($token)->postJson('/api/v1/site/music/rooms', ['group_type' => 'community', 'group_id' => $this->community->id])
            ->assertCreated()->json('code');
        $this->withToken($token)->getJson("/api/v1/site/music/rooms/community/{$this->community->id}")->assertOk()->assertJsonPath('room.code', $code);
        $this->withToken($token)->getJson("/api/v1/listen/{$code}/state")->assertOk()->assertJsonPath('room.moderated', true);
        $this->withToken($token)->postJson("/api/v1/listen/{$code}/react", ['emoji' => '🎉'])->assertOk();
        $this->withToken($token)->postJson("/api/v1/listen/{$code}/chat", ['body' => 'Привіт'])->assertCreated();
    }
}
