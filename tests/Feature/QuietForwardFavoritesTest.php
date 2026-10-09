<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageFavorite;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class QuietForwardFavoritesTest extends TestCase
{
    use RefreshDatabase;

    public function test_quiet_friends_forward_and_favorites(): void
    {
        $this->withoutVite();
        $viewer = User::factory()->create(['username' => 'viewer', 'first_name' => 'Тарас', 'last_name' => 'Шевченко']);
        $quiet = User::factory()->create(['username' => 'quiet']);
        $fresh = User::factory()->create(['username' => 'fresh']);
        $old = User::factory()->create(['username' => 'oldfriend']);
        $friendships = app(FriendshipService::class);
        $messenger = app(Messenger::class);
        foreach ([$quiet, $fresh, $old] as $friend) {
            $friendships->request($viewer, $friend);
            $friendships->accept($friend, $viewer);
        }

        $freshChat = $messenger->direct($viewer, $fresh);
        $messenger->send($freshChat, $viewer, 'Щойно написав');
        $oldChat = $messenger->direct($viewer, $old);
        $messenger->send($oldChat, $viewer, 'Давнє привітання');
        $oldChat->forceFill(['last_message_at' => now()->subDays(40)])->save();

        $this->actingAs($viewer)->get(route('friends.index', ['tab' => 'stale']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('counts.stale', 2)
                ->where('users.data', fn ($rows) => collect($rows)->pluck('username')->sort()->values()->all() === ['oldfriend', 'quiet']));

        $messenger->send($messenger->direct($viewer, $quiet), $viewer, 'Нарешті привіт');
        $this->actingAs($viewer)->get(route('friends.index', ['tab' => 'stale']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('counts.stale', 1)
                ->where('users.data.0.username', 'oldfriend'));

        $source = Message::query()->where('conversation_id', $freshChat->id)->where('type', Message::TYPE_TEXT)->firstOrFail();
        $this->actingAs($viewer)->postJson(route('messages.messages.forward', [$freshChat, $source]), [
            'conversation_id' => $oldChat->id,
        ])->assertCreated()
            ->assertJsonPath('message.body', 'Щойно написав')
            ->assertJsonPath('message.forward.name', 'Тарас Шевченко');

        $this->assertSame(1, Message::query()->where('conversation_id', $oldChat->id)->where('body', 'Щойно написав')->count());

        $system = $freshChat->messages()->create([
            'user_id' => null,
            'type' => Message::TYPE_SYSTEM,
            'body' => 'Системне',
        ]);
        $this->actingAs($viewer)->postJson(route('messages.messages.forward', [$freshChat, $system]), [
            'conversation_id' => $oldChat->id,
        ])->assertStatus(422);

        $stranger = User::factory()->create();
        $this->actingAs($stranger)->postJson(route('messages.messages.forward', [$freshChat, $source]), [
            'conversation_id' => $oldChat->id,
        ])->assertNotFound();

        $this->actingAs($viewer)->postJson(route('messages.messages.favorite', [$freshChat, $source]))
            ->assertOk()
            ->assertJsonPath('starred', true);
        $this->actingAs($viewer)->get(route('messages.show', $freshChat))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('history.messages', fn ($rows) => collect($rows)->firstWhere('id', $source->id)['starred'] === true));
        $this->actingAs($viewer)->get(route('messages.saved'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('items.0.body', 'Щойно написав'));

        $this->actingAs($fresh)->get(route('messages.saved'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('items', []));

        $this->actingAs($viewer)->postJson(route('messages.messages.favorite', [$freshChat, $source]))
            ->assertOk()
            ->assertJsonPath('starred', false);
        $this->assertSame(0, MessageFavorite::query()->count());
    }
}
