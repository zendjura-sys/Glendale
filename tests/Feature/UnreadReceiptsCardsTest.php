<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Movie;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UnreadReceiptsCardsTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_unread_hidden_receipts_and_catalog_cards(): void
    {
        $this->withoutVite();
        $viewer = User::factory()->create(['username' => 'viewer']);
        $friend = User::factory()->create(['username' => 'friend']);
        app(FriendshipService::class)->request($viewer, $friend);
        app(FriendshipService::class)->accept($friend, $viewer);
        $messenger = app(Messenger::class);
        $chat = $messenger->direct($viewer, $friend);
        $message = $messenger->send($chat, $friend, 'Привіт');

        $this->actingAs($viewer)->postJson(route('messages.read', $chat), ['message_id' => $message->id])->assertOk();
        $this->actingAs($viewer)->get(route('messages.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('conversations.0.unread', 0));

        $this->actingAs($viewer)->post(route('messages.unread', $chat))->assertRedirect(route('messages.index'));
        $this->actingAs($viewer)->get(route('messages.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('conversations.0.unread', 1));
        $this->assertSame(1, $messenger->unreadConversations($viewer));

        $this->actingAs($viewer)->postJson(route('messages.read', $chat), ['message_id' => $message->id])->assertOk();
        $this->assertSame(0, $messenger->unreadConversations($viewer));

        $this->actingAs($viewer)->post(route('messages.receipts', $chat))->assertRedirect();
        $this->actingAs($friend)->get(route('messages.show', $chat))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('active.read_up_to', 0));

        $this->actingAs($viewer)->post(route('messages.receipts', $chat))->assertRedirect();
        $this->actingAs($friend)->get(route('messages.show', $chat))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('active.read_up_to', $message->id));

        $game = Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
        ]);
        $movie = Movie::query()->create([
            'slug' => 'matrix-1999',
            'type' => 'movie',
            'title' => 'Матриця',
            'is_published' => true,
        ]);

        $this->actingAs($viewer)->getJson(route('messages.cards', ['q' => 'Nova']))
            ->assertOk()
            ->assertJsonPath('cards.0.title', 'Nova Drift');

        $this->actingAs($viewer)->postJson(route('messages.store', $chat), [
            'card' => ['kind' => 'game', 'id' => $game->id],
        ])->assertCreated()
            ->assertJsonPath('message.card.title', 'Nova Drift')
            ->assertJsonPath('message.card.href', '/games/nova-drift')
            ->assertJsonPath('message.body', null);

        $this->actingAs($viewer)->postJson(route('messages.store', $chat), [
            'body' => 'Дивись',
            'card' => ['kind' => 'movie', 'id' => $movie->id],
        ])->assertCreated()->assertJsonPath('message.card.title', 'Матриця');

        $this->actingAs($viewer)->postJson(route('messages.store', $chat), [
            'card' => ['kind' => 'server', 'id' => 99999],
        ])->assertUnprocessable();
    }
}
