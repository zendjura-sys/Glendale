<?php

namespace Tests\Feature;

use App\Jobs\SendPushNotification;
use App\Models\Call;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Services\Messenger;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CallsTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;

    private User $bob;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Http::fake(['voice.gamecon.test/twirp/*' => Http::response([], 200)]);
        Bus::fake([SendPushNotification::class]);

        $settings = app(SiteSettings::class);
        $settings->put(['livekit_url' => 'wss://voice.gamecon.test', 'livekit_api_key' => 'APIgamecon']);
        $settings->putSecret('livekit_api_secret', 'test-livekit-secret-0123456789');

        $this->alice = User::factory()->create();
        $this->bob = User::factory()->create();
    }

    private function direct(): Conversation
    {
        return app(Messenger::class)->direct($this->alice, $this->bob);
    }

    private function lastSystemText(Conversation $conversation): ?string
    {
        return Message::query()->where('conversation_id', $conversation->id)->where('type', Message::TYPE_SYSTEM)->latest('id')->value('body');
    }

    public function test_direct_call_rings_is_answered_and_ends_with_duration_message(): void
    {
        $conversation = $this->direct();

        $this->actingAs($this->alice)->postJson(route('messages.call.start', $conversation))
            ->assertOk()
            ->assertJsonPath('room', fn (string $room) => str_starts_with($room, 'call-'))
            ->assertJsonPath('call.status', Call::STATUS_RINGING)
            ->assertJsonPath('call.invited', [$this->bob->id]);
        Bus::assertDispatched(SendPushNotification::class, fn ($job) => $job->userId === $this->bob->id && $job->data['type'] === 'call');

        $call = Call::query()->sole();
        $this->actingAs($this->bob)->postJson(route('calls.join', $call))->assertOk()->assertJsonPath('call.status', Call::STATUS_ACTIVE);
        $this->actingAs($this->bob)->getJson(route('messages.call.show', $conversation))->assertJsonCount(2, 'call.joined');

        // Співрозмовник поклав слухавку — особистий дзвінок завершено для обох.
        $this->actingAs($this->bob)->postJson(route('calls.leave', $call))->assertOk();
        $this->assertSame(Call::STATUS_ENDED, $call->fresh()->status);
        $this->assertStringStartsWith('Дзвінок · 0:', (string) $this->lastSystemText($conversation));
        $this->actingAs($this->alice)->getJson(route('messages.call.show', $conversation))->assertJsonPath('call', null);
    }

    public function test_declined_and_missed_calls_leave_a_note_in_the_chat(): void
    {
        $conversation = $this->direct();

        $this->actingAs($this->alice)->postJson(route('messages.call.start', $conversation))->assertOk();
        $this->actingAs($this->bob)->postJson(route('calls.decline', Call::query()->sole()))->assertOk();
        $this->assertSame('Дзвінок відхилено', $this->lastSystemText($conversation));

        $this->actingAs($this->alice)->postJson(route('messages.call.start', $conversation))->assertOk();
        $call = Call::query()->where('status', '!=', Call::STATUS_ENDED)->sole();
        $call->forceFill(['created_at' => now()->subMinute()])->save();
        $this->artisan('calls:expire')->assertSuccessful();
        $this->assertSame(Call::STATUS_ENDED, $call->fresh()->status);
        $this->assertSame('Пропущений дзвінок', $this->lastSystemText($conversation));
    }

    public function test_group_call_stays_open_as_voice_channel_and_others_can_join_later(): void
    {
        $carol = User::factory()->create();
        $group = Conversation::query()->create(['type' => Conversation::TYPE_GROUP, 'title' => 'Рейд', 'owner_id' => $this->alice->id]);
        foreach ([$this->alice, $this->bob, $carol] as $user) {
            $group->participants()->create(['user_id' => $user->id, 'role' => $user->is($this->alice) ? ConversationParticipant::ROLE_OWNER : ConversationParticipant::ROLE_MEMBER, 'joined_at' => now()]);
        }

        $this->actingAs($this->alice)->postJson(route('messages.call.start', $group))->assertOk();
        $call = Call::query()->sole();
        $call->forceFill(['created_at' => now()->subMinute()])->save();
        $this->artisan('calls:expire')->assertSuccessful();

        // Ніхто не відповів, але засновник у каналі — дзвінок не дзвонить, проте лишається відкритим.
        $this->assertSame(Call::STATUS_ACTIVE, $call->fresh()->status);
        $this->actingAs($carol)->postJson(route('messages.call.start', $group))->assertOk()->assertJsonPath('call.id', $call->id);
        $this->assertNotNull($call->fresh()->answered_at);

        $this->actingAs($this->alice)->postJson(route('calls.leave', $call))->assertOk();
        $this->assertSame(Call::STATUS_ACTIVE, $call->fresh()->status);
        $this->actingAs($carol)->postJson(route('calls.leave', $call))->assertOk();
        $this->assertSame(Call::STATUS_ENDED, $call->fresh()->status);
        $this->assertStringStartsWith('Груповий дзвінок · ', (string) $this->lastSystemText($group));
    }

    public function test_only_participants_who_may_message_can_call(): void
    {
        $conversation = $this->direct();

        $this->actingAs(User::factory()->create())->postJson(route('messages.call.start', $conversation))->assertNotFound();

        $this->bob->update(['message_privacy' => User::MESSAGES_FRIENDS]);
        $this->actingAs($this->alice)->postJson(route('messages.call.start', $conversation))->assertForbidden();
        $this->assertSame(0, Call::query()->count());
    }

    public function test_calls_need_a_configured_voice_server(): void
    {
        app(SiteSettings::class)->put(['livekit_url' => '']);
        config(['services.livekit.url' => null]);

        $this->actingAs($this->alice)->postJson(route('messages.call.start', $this->direct()))->assertStatus(503);
    }
}
