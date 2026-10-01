<?php

namespace Tests\Feature;

use App\Events\Messenger\ConversationRead;
use App\Events\Messenger\InboxUpdated;
use App\Events\Messenger\MessageDeleted;
use App\Events\Messenger\MessageSent;
use App\Events\Messenger\MessageUpdated;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Services\Messenger;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MessengerTest extends TestCase
{
    use RefreshDatabase;

    private function befriend(User $a, User $b): void
    {
        $this->actingAs($a)->post(route('friends.store', $b));
        $this->actingAs($b)->post(route('friends.accept', $a));
    }

    private function direct(User $a, User $b): Conversation
    {
        return app(Messenger::class)->direct($a, $b);
    }

    private function send(User $user, Conversation $conversation, array $data = ['body' => 'Привіт!'])
    {
        return $this->actingAs($user)->post(route('messages.store', $conversation), $data, ['Accept' => 'application/json']);
    }

    public function test_direct_link_creates_a_single_conversation_and_opens_it(): void
    {
        [$anna, $boris] = User::factory()->count(2)->create();

        $first = $this->actingAs($anna)->get(route('messages.direct', $boris));
        $conversation = Conversation::query()->sole();
        $first->assertRedirect(route('messages.show', $conversation));

        $this->actingAs($boris)->get(route('messages.direct', $anna))->assertRedirect(route('messages.show', $conversation));
        $this->assertSame(1, Conversation::query()->count());
        $this->assertSame(Conversation::directKey($anna->id, $boris->id), $conversation->direct_key);

        $this->actingAs($anna)->get(route('messages.show', $conversation))
            ->assertInertia(fn (Assert $page) => $page
                ->component('messages/index')
                ->where('active.title', $boris->name)
                ->where('active.can_write', true)
                ->has('conversations', 1)
                ->has('history.messages', 0));
    }

    public function test_friends_only_privacy_blocks_strangers(): void
    {
        [$anna, $boris, $friend] = User::factory()->count(3)->create();
        $boris->update(['message_privacy' => User::MESSAGES_FRIENDS]);
        $this->befriend($boris, $friend);

        $this->actingAs($anna)->from('/'.$boris->username)->get(route('messages.direct', $boris))->assertRedirect('/'.$boris->username);
        $this->assertSame(0, Conversation::query()->count());

        $this->actingAs($friend)->get(route('messages.direct', $boris))->assertRedirect();
        $this->assertSame(1, Conversation::query()->count());

        $existing = $this->direct($anna, $boris);
        $this->send($anna, $existing)->assertForbidden();
    }

    public function test_sending_text_and_images_with_reply_broadcasts_to_everyone(): void
    {
        Storage::fake('public');
        Event::fake([MessageSent::class, InboxUpdated::class]);
        [$anna, $boris] = User::factory()->count(2)->create();
        $conversation = $this->direct($anna, $boris);

        $first = $this->send($anna, $conversation)->assertCreated()->json('message');

        $this->send($boris, $conversation, [
            'body' => '  Дивись  ',
            'reply_to_id' => $first['id'],
            'images' => [UploadedFile::fake()->image('a.jpg', 800, 600), UploadedFile::fake()->image('b.png', 400, 400)],
        ])
            ->assertCreated()
            ->assertJsonPath('message.body', 'Дивись')
            ->assertJsonPath('message.reply_to.id', $first['id'])
            ->assertJsonPath('message.reply_to.author', $anna->first_name)
            ->assertJsonCount(2, 'message.attachments');

        $conversation->refresh();
        $this->assertSame(Message::query()->latest('id')->value('id'), $conversation->last_message_id);
        Event::assertDispatchedTimes(MessageSent::class, 2);
        Event::assertDispatchedTimes(InboxUpdated::class, 4);
        Event::assertDispatched(MessageSent::class, fn (MessageSent $e) => $e->broadcastOn()->name === "private-conversation.{$conversation->id}");
    }

    public function test_empty_messages_and_outsiders_are_rejected(): void
    {
        [$anna, $boris, $eve] = User::factory()->count(3)->create();
        $conversation = $this->direct($anna, $boris);

        $this->send($anna, $conversation, ['body' => '   '])->assertUnprocessable();
        $this->send($eve, $conversation)->assertNotFound();
        $this->actingAs($eve)->get(route('messages.show', $conversation))->assertNotFound();
        $this->actingAs($eve)->getJson(route('messages.history', $conversation))->assertNotFound();
    }

    public function test_edit_window_and_ownership(): void
    {
        Event::fake([MessageUpdated::class]);
        [$anna, $boris] = User::factory()->count(2)->create();
        $conversation = $this->direct($anna, $boris);
        $id = $this->send($anna, $conversation)->json('message.id');

        $this->actingAs($boris)->patchJson(route('messages.messages.update', [$conversation, $id]), ['body' => 'Хак'])->assertForbidden();

        $this->actingAs($anna)->patchJson(route('messages.messages.update', [$conversation, $id]), ['body' => 'Привіт, Борисе!'])
            ->assertOk()
            ->assertJsonPath('message.body', 'Привіт, Борисе!');
        $this->assertNotNull(Message::query()->find($id)->edited_at);
        Event::assertDispatched(MessageUpdated::class);

        $this->travel(Message::EDIT_WINDOW_HOURS + 1)->hours();
        $this->actingAs($anna)->patchJson(route('messages.messages.update', [$conversation, $id]), ['body' => 'Пізно'])->assertForbidden();
    }

    public function test_deleting_the_last_message_rolls_back_the_preview(): void
    {
        Event::fake([MessageDeleted::class]);
        [$anna, $boris] = User::factory()->count(2)->create();
        $conversation = $this->direct($anna, $boris);
        $first = $this->send($anna, $conversation)->json('message.id');
        $second = $this->send($boris, $conversation)->json('message.id');

        $this->actingAs($anna)->deleteJson(route('messages.messages.destroy', [$conversation, $second]))->assertForbidden();
        $this->actingAs($boris)->deleteJson(route('messages.messages.destroy', [$conversation, $second]))->assertOk();

        $this->assertSoftDeleted('messages', ['id' => $second]);
        $this->assertSame($first, $conversation->fresh()->last_message_id);
        Event::assertDispatched(MessageDeleted::class, fn (MessageDeleted $e) => $e->broadcastWith() === ['id' => $second]);
    }

    public function test_unread_counters_read_receipts_and_mute(): void
    {
        Event::fake([ConversationRead::class, InboxUpdated::class, MessageSent::class]);
        [$anna, $boris] = User::factory()->count(2)->create();
        $conversation = $this->direct($anna, $boris);
        $this->send($anna, $conversation);
        $last = $this->send($anna, $conversation)->json('message.id');

        $messenger = app(Messenger::class);
        $this->assertSame(1, $messenger->unreadConversations($boris));
        $this->assertSame(0, $messenger->unreadConversations($anna));

        $this->actingAs($boris)->get(route('feed'))->assertInertia(fn (Assert $page) => $page->where('counters.messages', 1));
        $this->actingAs($boris)->get(route('messages.index'))
            ->assertInertia(fn (Assert $page) => $page->where('conversations.0.unread', 2)->where('conversations.0.last_message.is_own', false));

        $this->actingAs($boris)->postJson(route('messages.read', $conversation), ['message_id' => $last])
            ->assertOk()
            ->assertJsonPath('unread_total', 0);
        Event::assertDispatched(ConversationRead::class, fn (ConversationRead $e) => $e->broadcastWith() === ['user_id' => $boris->id, 'message_id' => $last]);

        $this->actingAs($anna)->get(route('messages.show', $conversation))
            ->assertInertia(fn (Assert $page) => $page->where('active.read_up_to', $last));

        $this->send($anna, $conversation);
        $this->actingAs($boris)->post(route('messages.mute', $conversation))->assertRedirect();
        $this->assertTrue($conversation->participantFor($boris)->is_muted);
        $this->assertSame(0, $messenger->unreadConversations($boris));
    }

    public function test_history_is_paginated_backwards(): void
    {
        [$anna, $boris] = User::factory()->count(2)->create();
        $conversation = $this->direct($anna, $boris);
        $messenger = app(Messenger::class);

        foreach (range(1, 45) as $i) {
            $messenger->send($conversation, $i % 2 ? $anna : $boris, "Повідомлення {$i}");
        }

        $page = $this->actingAs($anna)->getJson(route('messages.history', $conversation))->assertOk();
        $page->assertJsonCount(40, 'messages')->assertJsonPath('has_more', true)->assertJsonPath('messages.39.body', 'Повідомлення 45');

        $older = $this->actingAs($anna)->getJson(route('messages.history', [$conversation, 'before' => $page->json('messages.0.id')]));
        $older->assertJsonCount(5, 'messages')->assertJsonPath('has_more', false)->assertJsonPath('messages.0.body', 'Повідомлення 1');
    }

    public function test_group_lifecycle_with_friends_only_and_ownership_transfer(): void
    {
        [$owner, $friend, $other, $stranger] = User::factory()->count(4)->create();
        $this->befriend($owner, $friend);
        $this->befriend($owner, $other);

        $this->actingAs($owner)->post(route('messages.groups.store'), [
            'title' => '  Рейд  ',
            'user_ids' => [$friend->id, $stranger->id],
        ])->assertRedirect();

        $group = Conversation::query()->where('type', Conversation::TYPE_GROUP)->sole();
        $this->assertSame('Рейд', $group->title);
        $this->assertSame([$owner->id, $friend->id], $group->activeParticipants()->orderBy('user_id')->pluck('user_id')->all());
        $this->assertSame(Message::TYPE_SYSTEM, $group->lastMessage->type);

        $this->actingAs($friend)->post(route('messages.update', $group), ['title' => 'Злам'])->assertForbidden();
        $this->actingAs($owner)->post(route('messages.update', $group), ['title' => 'Нічний рейд'])->assertRedirect();
        $this->assertSame('Нічний рейд', $group->fresh()->title);

        $this->actingAs($owner)->post(route('messages.members.store', $group), ['user_ids' => [$other->id]])->assertRedirect();
        $this->assertSame(3, $group->activeParticipants()->count());

        $this->actingAs($friend)->delete(route('messages.members.destroy', [$group, $other]))->assertForbidden();
        $this->actingAs($owner)->delete(route('messages.members.destroy', [$group, $other]))->assertRedirect();
        $this->assertNull($group->participantFor($other));
        $this->send($other, $group)->assertNotFound();

        $this->actingAs($owner)->delete(route('messages.members.destroy', [$group, $owner]))->assertRedirect(route('messages.index'));
        $group->refresh();
        $this->assertSame($friend->id, $group->owner_id);
        $this->assertSame(ConversationParticipant::ROLE_OWNER, $group->participantFor($friend)->role);
    }

    public function test_channel_authorization_only_for_active_participants(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'key',
            'broadcasting.connections.reverb.secret' => 'secret',
            'broadcasting.connections.reverb.app_id' => '1',
        ]);
        Broadcast::purge();
        require base_path('routes/channels.php');

        [$anna, $boris, $eve] = User::factory()->count(3)->create();
        $conversation = $this->direct($anna, $boris);
        $auth = fn (User $user, string $channel) => $this->actingAs($user)->postJson('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => $channel,
        ]);

        $auth($anna, "private-conversation.{$conversation->id}")->assertOk()->assertJsonStructure(['auth']);
        $auth($eve, "private-conversation.{$conversation->id}")->assertForbidden();
        $auth($anna, "private-App.Models.User.{$anna->id}")->assertOk();
        $auth($anna, "private-App.Models.User.{$boris->id}")->assertForbidden();
    }

    public function test_module_can_be_switched_off(): void
    {
        $user = User::factory()->create();
        app(ModuleManager::class)->set('messages', false);

        $this->actingAs($user)->get(route('messages.index'))->assertNotFound();
        $this->actingAs($user)->get(route('feed'))->assertInertia(fn (Assert $page) => $page->where('counters.messages', 0));
    }
}
