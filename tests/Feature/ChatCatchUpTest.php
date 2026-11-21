<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\MessageReaction;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** «Поки тебе не було»: згадки, домовленості, посилання й популярне в непрочитаному групи. */
class ChatCatchUpTest extends TestCase
{
    use RefreshDatabase;

    public function test_group_summary_of_unread_messages(): void
    {
        $owner = User::factory()->create(['username' => 'kapitan']);
        $me = User::factory()->create(['username' => 'tonny']);
        $friends = app(FriendshipService::class);
        $friends->request($owner, $me);
        $friends->accept($me, $owner);
        $messenger = app(Messenger::class);
        $chat = $messenger->createGroup($owner, 'Рейд', [$me->id]);

        // Мало непрочитаного — зведеної немає.
        $messenger->send($chat, $owner, 'привіт');
        $this->actingAs($me)->get('/messages/'.$chat->id)->assertInertia(fn (Assert $page) => $page->where('active.catch_up', null));

        foreach (range(1, 14) as $i) {
            $messenger->send($chat, $owner, "просто балачки $i");
        }
        $plan = $messenger->send($chat, $owner, 'Домовились: граємо о 21:00');
        $mention = $messenger->send($chat, $owner, '@tonny ти з нами?');
        $link = $messenger->send($chat, $owner, 'Гляньте https://example.org/patch');
        $hot = $messenger->send($chat, $owner, 'Мем дня');
        foreach (User::factory()->count(2)->create() as $fan) {
            MessageReaction::query()->forceCreate(['message_id' => $hot->id, 'user_id' => $fan->id, 'emoji' => '😂', 'created_at' => now()]);
        }

        $this->actingAs($me)->get('/messages/'.$chat->id)->assertInertia(fn (Assert $page) => $page
            ->where('active.catch_up.count', 19)
            ->where('active.catch_up.people', 1)
            ->where('active.catch_up.sections.0.key', 'mentions')
            ->where('active.catch_up.sections.0.items.0.id', $mention->id)
            ->where('active.catch_up.sections.1.key', 'plans')
            ->where('active.catch_up.sections.1.items.0.id', $plan->id)
            ->where('active.catch_up.sections.2.key', 'popular')
            ->where('active.catch_up.sections.2.items.0.id', $hot->id)
            ->where('active.catch_up.sections.3.key', 'links')
            ->where('active.catch_up.sections.3.items.0.link', 'example.org'));

        // Застосунок — через міст; після прочитання зведена зникає.
        $token = app(ApiTokens::class)->issue($me, 'android');
        $this->withToken($token)->getJson("/api/v1/site/messages/{$chat->id}/catch-up")->assertOk()->assertJsonPath('catch_up.count', 19);
        $this->actingAs($me)->post("/messages/{$chat->id}/read", ['message_id' => Message::query()->max('id')]);
        $this->actingAs($me)->getJson("/messages/{$chat->id}/catch-up")->assertOk()->assertJsonPath('catch_up', null);

        app(Plugins::class)->set('chat_catch_up', false);
        $this->actingAs($me)->getJson("/messages/{$chat->id}/catch-up?after=1")->assertJsonPath('catch_up', null);
    }
}
