<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SlowModeRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_slow_mode_admin_role_and_per_chat_mute(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $other = User::factory()->create();
        $stranger = User::factory()->create();
        $friends = app(FriendshipService::class);
        $friends->request($owner, $member);
        $friends->accept($member, $owner);
        $friends->request($owner, $other);
        $friends->accept($other, $owner);

        $messenger = app(Messenger::class);
        $chat = $messenger->createGroup($owner, 'Рейд', [$member->id, $other->id]);

        $this->actingAs($member)->post(route('messages.slow', $chat), ['seconds' => 30])->assertForbidden();
        $this->actingAs($owner)->post(route('messages.slow', $chat), ['seconds' => 30])->assertRedirect();
        $this->assertSame(30, (int) $chat->fresh()->slow_seconds);

        $this->actingAs($member)->postJson(route('messages.store', $chat), ['body' => 'перше'])->assertCreated();
        $this->actingAs($member)->postJson(route('messages.store', $chat), ['body' => 'друге'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');

        $this->actingAs($owner)->postJson(route('messages.store', $chat), ['body' => 'від творця'])->assertCreated();
        $this->actingAs($owner)->postJson(route('messages.store', $chat), ['body' => 'ще раз'])->assertCreated();

        $this->actingAs($member)->post(route('messages.members.role', [$chat, $other]), ['role' => 'admin'])->assertForbidden();
        $this->actingAs($stranger)->post(route('messages.members.role', [$chat, $other]), ['role' => 'admin'])->assertForbidden();
        $this->actingAs($owner)->post(route('messages.members.role', [$chat, $other]), ['role' => 'admin'])->assertRedirect();

        $this->actingAs($other)->postJson(route('messages.store', $chat), ['body' => 'адмін'])->assertCreated();
        $this->actingAs($other)->postJson(route('messages.store', $chat), ['body' => 'знову'])->assertCreated();

        $this->actingAs($owner)->post(route('messages.members.role', [$chat, $other]), ['role' => 'member'])->assertRedirect();
        $this->actingAs($other)->postJson(route('messages.store', $chat), ['body' => 'знову член'])->assertUnprocessable();

        $this->actingAs($owner)->post(route('messages.slow', $chat), ['seconds' => 0])->assertRedirect();
        $this->actingAs($member)->postJson(route('messages.store', $chat), ['body' => 'можна знову'])->assertCreated();

        $chat->refresh();
        $messenger->markRead($chat, $member, (int) $chat->last_message_id);
        $direct = $messenger->direct($owner, $member);
        $messenger->send($direct, $owner, 'привіт');
        $this->assertSame(1, $messenger->unreadConversations($member));
        $this->actingAs($member)->post(route('messages.mute', $direct))->assertRedirect();
        $this->assertSame(0, $messenger->unreadConversations($member));
    }
}
