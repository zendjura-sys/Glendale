<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Friendship;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\StickerPack;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChatExtrasTest extends TestCase
{
    use RefreshDatabase;

    public function test_thread_replies_stay_out_of_main_history(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        Friendship::query()->create(['requester_id' => $owner->id, 'addressee_id' => $member->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $chat = app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]);
        $root = $this->actingAs($owner)->postJson("/messages/{$chat->id}", ['body' => 'Хто сьогодні?'])->assertCreated()->json('message.id');

        $this->actingAs($member)->postJson("/messages/{$chat->id}/messages/{$root}/thread", ['body' => 'Я о 20:00'])->assertCreated()->assertJsonPath('message.thread_root_id', $root);
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/messages/{$root}/thread", ['body' => 'Ок'])->assertCreated();

        $history = $this->actingAs($owner)->getJson("/messages/{$chat->id}/history")->json('messages');
        $texts = array_column(array_filter($history, fn (array $m) => $m['type'] === 'text'), 'body');
        $this->assertSame(['Хто сьогодні?'], array_values($texts));
        $this->assertSame(2, Message::query()->find($root)?->thread_count);

        $this->actingAs($member)->getJson("/messages/{$chat->id}/messages/{$root}/thread")->assertOk()
            ->assertJsonPath('root.thread.count', 2)->assertJsonCount(2, 'messages');
        // У відповіді гілки не можна відкрити свою гілку; чужі не бачать.
        $outsider = User::factory()->create();
        $this->actingAs($outsider)->getJson("/messages/{$chat->id}/messages/{$root}/thread")->assertNotFound();
    }

    public function test_pins_limit_and_group_admin_only(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        Friendship::query()->create(['requester_id' => $owner->id, 'addressee_id' => $member->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $chat = app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]);
        $ids = [];
        foreach (range(1, 11) as $i) {
            $ids[] = $this->actingAs($owner)->postJson("/messages/{$chat->id}", ['body' => "Повідомлення {$i}"])->json('message.id');
        }
        $this->actingAs($member)->postJson("/messages/{$chat->id}/messages/{$ids[0]}/pin")->assertForbidden();
        foreach (array_slice($ids, 0, 10) as $id) {
            $this->actingAs($owner)->postJson("/messages/{$chat->id}/messages/{$id}/pin")->assertOk()->assertJsonPath('pinned', true);
        }
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/messages/{$ids[10]}/pin")->assertStatus(422);
        // Повторно — відкріпити.
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/messages/{$ids[0]}/pin")->assertJsonPath('pinned', false)->assertJsonCount(9, 'pins');
        $this->actingAs($member)->get("/messages/{$chat->id}")->assertInertia(fn ($page) => $page->has('active.pins', 9)->where('active.can_pin', false));
    }

    public function test_note_is_private(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $chat = app(Messenger::class)->direct($a, $b);
        $this->actingAs($a)->putJson("/messages/{$chat->id}/note", ['note' => 'Днюха 5 березня'])->assertOk()->assertJsonPath('note', 'Днюха 5 березня');
        $this->actingAs($a)->get("/messages/{$chat->id}")->assertInertia(fn ($page) => $page->where('active.note', 'Днюха 5 березня'));
        $this->actingAs($b)->get("/messages/{$chat->id}")->assertInertia(fn ($page) => $page->where('active.note', null));
    }

    public function test_view_once_photo_opens_once_for_recipient_only(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $a = User::factory()->create();
        $b = User::factory()->create();
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $chat = app(Messenger::class)->direct($a, $b);

        $this->actingAs($a)->post("/messages/{$chat->id}", ['images' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')], 'view_once' => '1'], ['Accept' => 'application/json'])->assertStatus(422);
        $sent = $this->actingAs($a)->post("/messages/{$chat->id}", ['images' => [UploadedFile::fake()->image('a.jpg', 40, 40)], 'view_once' => '1'], ['Accept' => 'application/json'])->assertCreated()->json('message');
        $attachment = $sent['attachments'][0];
        $this->assertTrue($attachment['view_once']);
        $this->assertNull($attachment['url']);

        $this->actingAs($a)->get("/messages/attachments/{$attachment['id']}/once")->assertStatus(410);
        $this->actingAs($b)->get("/messages/attachments/{$attachment['id']}/once")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->actingAs($b)->get("/messages/attachments/{$attachment['id']}/once")->assertStatus(410);
        $this->actingAs($b)->getJson("/messages/{$chat->id}/history")->assertJsonPath('messages.0.attachments.0.viewed_by', [$b->id]);
    }

    public function test_community_sticker_pack_for_members_only(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $stranger = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'CS2 UA', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
        app(CommunityService::class)->join($community, $member);

        $this->actingAs($member)->post("/c/{$community->slug}/stickers", ['stickers' => [UploadedFile::fake()->image('s.png', 128, 128)]])->assertForbidden();
        $this->actingAs($owner)->post("/c/{$community->slug}/stickers", ['stickers' => [UploadedFile::fake()->image('s.png', 128, 128)]])->assertRedirect();
        $pack = StickerPack::query()->where('community_id', $community->id)->sole();
        $sticker = $pack->stickers()->sole();

        // Учасник бачить набір і може надіслати; сторонній — ні.
        $this->actingAs($member)->getJson('/messages/stickers')->assertJsonPath('packs.0.community', 'CS2 UA');
        $this->assertNotContains($pack->id, array_column($this->actingAs($stranger)->getJson('/messages/stickers')->json('packs'), 'id'));
        Friendship::query()->create(['requester_id' => $member->id, 'addressee_id' => $stranger->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $chat = app(Messenger::class)->direct($member, $stranger);
        $this->actingAs($member)->postJson("/messages/{$chat->id}", ['sticker_id' => $sticker->id])->assertCreated();
        $this->actingAs($stranger)->postJson("/messages/{$chat->id}", ['sticker_id' => $sticker->id])->assertStatus(422);
    }

    public function test_voice_message_is_transcribed_once_for_participants(): void
    {
        Storage::fake('public');
        Http::fake(['api.groq.com/*' => Http::response(['text' => 'Заходь у дискорд о восьмій'])]);
        $owner = User::factory()->create();
        $member = User::factory()->create();
        Friendship::query()->create(['requester_id' => $owner->id, 'addressee_id' => $member->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $chat = app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]);
        $message = Message::query()->create(['conversation_id' => $chat->id, 'user_id' => $owner->id, 'type' => Message::TYPE_VOICE, 'body' => null]);
        Storage::disk('public')->put('voice/a.webm', 'audio');
        $message->attachments()->create(['type' => MessageAttachment::TYPE_VOICE, 'disk' => 'public', 'path' => 'voice/a.webm', 'mime' => 'audio/webm', 'duration' => 4, 'position' => 0]);
        $url = "/messages/{$chat->id}/messages/{$message->id}/transcribe";

        // Ключа ще немає — зрозуміла відмова.
        $this->actingAs($member)->postJson($url)->assertStatus(422)->assertJsonPath('message', 'Розшифровку ще не підключено: адміністрація не додала ключ.');

        app(SiteSettings::class)->putSecret('stt_key', 'gsk_test_1234567890');
        app(SiteSettings::class)->put(['stt_base_url' => 'https://api.groq.com/openai/v1', 'stt_model' => 'whisper-large-v3']);
        $this->actingAs($member)->postJson($url)->assertOk()->assertJsonPath('text', 'Заходь у дискорд о восьмій');
        $this->actingAs($owner)->postJson($url)->assertOk()->assertJsonPath('text', 'Заходь у дискорд о восьмій');
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/audio/transcriptions'));
        // Текст іде разом з повідомленням в історії; чужим — ні.
        $this->assertSame('Заходь у дискорд о восьмій', app(MessengerPresenter::class)->message($message->fresh()->load('attachments'))['attachments'][0]['transcript']);
        $this->actingAs(User::factory()->create())->postJson($url)->assertNotFound();
    }
}
