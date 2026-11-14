<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Community;
use App\Models\Game;
use App\Models\GameGuide;
use App\Models\InviteLink;
use App\Models\Message;
use App\Models\PartyPost;
use App\Models\Post;
use App\Models\User;
use App\Models\VoiceRoom;
use App\Services\CommunityService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Реакції й кружки в чатах, «Дякую», запрошення в паті й голосову кімнату. */
class BatchBFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_reactions_one_per_person_and_toggle(): void
    {
        [$a, $b] = User::factory()->count(2)->create();
        $conversation = app(Messenger::class)->direct($a, $b);
        $message = app(Messenger::class)->send($conversation, $a, 'Го в CS?');
        $url = "/messages/{$conversation->id}/messages/{$message->id}/react";

        $this->actingAs($b)->postJson($url, ['emoji' => '🔥'])->assertOk()
            ->assertJsonPath('message.reactions.0.emoji', '🔥')->assertJsonPath('message.reactions.0.user_ids', [$b->id]);
        $this->actingAs($a)->postJson($url, ['emoji' => '🔥'])->assertJsonPath('message.reactions.0.count', 2);
        // Інша реакція замінює попередню.
        $this->actingAs($b)->postJson($url, ['emoji' => '😂'])->assertJsonCount(2, 'message.reactions');
        // Той самий емодзі ще раз — прибрати.
        $this->actingAs($b)->postJson($url, ['emoji' => '😂'])->assertJsonCount(1, 'message.reactions');
        $this->actingAs($b)->postJson($url, ['emoji' => '💩'])->assertUnprocessable();
        $this->actingAs(User::factory()->create())->postJson($url, ['emoji' => '👍'])->assertNotFound();

        $this->actingAs($a)->getJson("/messages/{$conversation->id}/history")->assertJsonPath('messages.0.reactions.0.emoji', '🔥');
    }

    public function test_video_note_is_sent(): void
    {
        Storage::fake('public');
        [$a, $b] = User::factory()->count(2)->create();
        $conversation = app(Messenger::class)->direct($a, $b);

        $this->actingAs($a)->post("/messages/{$conversation->id}", [
            'video_note' => UploadedFile::fake()->create('note.webm', 300, 'video/webm'),
            'video_duration' => 12,
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('message.type', Message::TYPE_VIDEO_NOTE)
            ->assertJsonPath('message.attachments.0.type', 'video_note')
            ->assertJsonPath('message.attachments.0.duration', 12)
            ->assertJsonPath('message.preview', 'Відеоповідомлення');

        $this->actingAs($a)->post("/messages/{$conversation->id}", [
            'video_note' => UploadedFile::fake()->create('note.webm', 300, 'video/webm'),
            'video_duration' => 90,
        ], ['Accept' => 'application/json'])->assertUnprocessable();
    }

    public function test_thanks_for_guides_and_comments_count_in_profile(): void
    {
        [$author, $reader] = User::factory()->count(2)->create();
        $game = Game::query()->create(['slug' => 'apex', 'name' => 'Apex', 'letter' => 'A', 'category' => 'pc', 'is_published' => true]);
        $guide = GameGuide::query()->create(['game_id' => $game->id, 'user_id' => $author->id, 'title' => 'Як стріляти', 'body' => 'Цільтесь у голову.']);
        $post = Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => 'Пост', 'visibility' => 'public']);
        $comment = Comment::query()->create(['post_id' => $post->id, 'user_id' => $author->id, 'body' => 'Порада']);

        $this->actingAs($reader)->postJson('/thanks', ['kind' => 'guide', 'id' => $guide->id])->assertOk()->assertJsonPath('thanked', true)->assertJsonPath('count', 1);
        $this->actingAs($reader)->postJson('/thanks', ['kind' => 'comment', 'id' => $comment->id])->assertJsonPath('thanked', true);
        $this->actingAs($author)->postJson('/thanks', ['kind' => 'guide', 'id' => $guide->id])->assertUnprocessable();

        $this->actingAs($reader)->get('/'.$author->username)->assertInertia(fn ($page) => $page->where('stats.thanks', 2));
        $this->actingAs($reader)->get('/games/apex')->assertInertia(fn ($page) => $page
            ->where('guides.0.thanks', 1)->where('guides.0.thanked', true)->where('guides.0.can_thank', true));

        $this->actingAs($reader)->postJson('/thanks', ['kind' => 'guide', 'id' => $guide->id])->assertJsonPath('thanked', false)->assertJsonPath('count', 0);
    }

    public function test_party_invite_link_joins_party(): void
    {
        [$host, $friend] = User::factory()->count(2)->create();
        $party = PartyPost::query()->create(['user_id' => $host->id, 'title' => 'Ранкед', 'slots' => 5, 'expires_at' => now()->addHours(3)]);

        $url = $this->actingAs($host)->postJson("/party/{$party->id}/invite-link")->assertOk()->json('url');
        $token = basename((string) $url);
        $this->actingAs($friend)->get("/join/{$token}")->assertInertia(fn ($page) => $page->where('invite.kind', 'party')->where('invite.name', 'Ранкед'));
        $this->actingAs($friend)->post("/join/{$token}")->assertRedirect("/party/{$party->id}");
        $this->assertTrue($party->fresh()->hasMember($friend));

        // Сторонній не може видавати посилання.
        $this->actingAs(User::factory()->create())->postJson("/party/{$party->id}/invite-link")->assertForbidden();
    }

    public function test_voice_invite_opens_room_for_members_and_joins_open_community(): void
    {
        [$owner, $guest] = User::factory()->count(2)->create();
        $open = app(CommunityService::class)->create($owner, ['name' => 'Відкриті', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        $closed = app(CommunityService::class)->create($owner, ['name' => 'Закриті', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_CLOSED, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        $room = VoiceRoom::query()->create(['owner_type' => 'community', 'owner_id' => $open->id, 'name' => 'Лобі']);
        $secret = VoiceRoom::query()->create(['owner_type' => 'community', 'owner_id' => $closed->id, 'name' => 'Штаб']);

        $token = basename((string) $this->actingAs($owner)->postJson("/voice/rooms/{$room->id}/invite-link")->assertOk()->json('url'));
        $this->actingAs($guest)->post("/join/{$token}")->assertRedirect('/c/'.$open->slug.'?voice='.$room->id);
        $this->assertTrue($open->membershipFor($guest)->isActive());

        $secretToken = basename((string) $this->actingAs($owner)->postJson("/voice/rooms/{$secret->id}/invite-link")->json('url'));
        $this->actingAs($guest)->post("/join/{$secretToken}")->assertForbidden();
        $this->actingAs($guest)->postJson("/voice/rooms/{$secret->id}/invite-link")->assertForbidden();
        $this->assertSame(2, InviteLink::query()->where('kind', InviteLink::VOICE)->count());
    }
}
