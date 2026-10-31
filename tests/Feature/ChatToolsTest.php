<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Models\Conversation;
use App\Models\MessageAttachment;
use App\Models\User;
use App\Services\Communities\CommunityChannels;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Матеріали чату, перегляд документів, тайм-аут і виключення на час, фон чату. */
class ChatToolsTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: Conversation, 1: User, 2: User, 3: User} */
    private function group(): array
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $other = User::factory()->create();
        $friends = app(FriendshipService::class);
        foreach ([$member, $other] as $friend) {
            $friends->request($owner, $friend);
            $friends->accept($friend, $owner);
        }

        return [app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id, $other->id]), $owner, $member, $other];
    }

    public function test_shared_panel_lists_media_files_links_and_voice(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        [$chat, $owner, $member] = $this->group();
        $messenger = app(Messenger::class);
        $messenger->send($chat, $owner, 'Фото з рейду', [UploadedFile::fake()->image('raid.jpg', 400, 300)]);
        $messenger->send($chat, $member, 'Гайд тут: https://example.com/guide і ще https://youtu.be/abc');
        $messenger->send($chat, $owner, null, documents: [UploadedFile::fake()->create('tactics.pdf', 120, 'application/pdf')]);

        $this->actingAs($member)->getJson("/messages/{$chat->id}/shared?kind=media")->assertOk()
            ->assertJsonPath('counts.media', 1)->assertJsonPath('counts.files', 1)->assertJsonPath('counts.links', 1)
            ->assertJsonCount(1, 'items');
        $this->actingAs($member)->getJson("/messages/{$chat->id}/shared?kind=links")->assertOk()
            ->assertJsonCount(2, 'items')->assertJsonPath('items.0.host', 'example.com');
        $this->actingAs($member)->getJson("/messages/{$chat->id}/shared?kind=files")->assertOk()
            ->assertJsonPath('items.0.name', 'tactics.pdf')->assertJsonPath('items.0.preview', 'pdf');
        $this->actingAs(User::factory()->create())->getJson("/messages/{$chat->id}/shared?kind=media")->assertNotFound();
    }

    public function test_documents_open_inline_only_for_participants(): void
    {
        Storage::fake('local');
        [$chat, $owner, $member] = $this->group();
        $messenger = app(Messenger::class);
        $messenger->send($chat, $owner, null, documents: [
            UploadedFile::fake()->createWithContent('notes.txt', "Смоки на A\nФлеш на B"),
            UploadedFile::fake()->create('mods.zip', 50, 'application/zip'),
        ]);
        [$text, $zip] = MessageAttachment::query()->orderBy('id')->get()->all();

        $response = $this->actingAs($member)->get("/messages/attachments/{$text->id}/preview")->assertOk();
        $this->assertStringContainsString('text/plain', (string) $response->headers->get('Content-Type'));
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('Смоки на A', $response->streamedContent());

        $this->actingAs($member)->get("/messages/attachments/{$zip->id}/preview")->assertStatus(415);
        $this->actingAs(User::factory()->create())->get("/messages/attachments/{$text->id}/preview")->assertNotFound();
    }

    public function test_timeout_blocks_writing_until_lifted(): void
    {
        [$chat, $owner, $member, $other] = $this->group();

        $this->actingAs($member)->post("/messages/{$chat->id}/members/{$other->username}/restrict", ['kind' => 'timeout', 'minutes' => 60])->assertForbidden();
        $this->actingAs($owner)->post("/messages/{$chat->id}/members/{$member->username}/restrict", ['kind' => 'timeout', 'minutes' => 7])->assertSessionHasErrors('minutes');
        $this->actingAs($owner)->post("/messages/{$chat->id}/members/{$member->username}/restrict", ['kind' => 'timeout', 'minutes' => 60])->assertRedirect();

        $this->actingAs($member)->postJson(route('messages.store', $chat), ['body' => 'ну чому'])->assertForbidden();
        $this->actingAs($member)->get("/messages/{$chat->id}")->assertInertia(fn (Assert $page) => $page
            ->where('active.timeout_until', fn ($value) => $value !== null));
        $this->assertStringContainsString('писати до', (string) $chat->messages()->latest('id')->value('body'));

        // Минув строк — пише знову.
        $this->travel(61)->minutes();
        $this->actingAs($member)->postJson(route('messages.store', $chat), ['body' => 'я повернувся'])->assertCreated();

        $this->actingAs($owner)->post("/messages/{$chat->id}/members/{$member->username}/restrict", ['kind' => 'timeout', 'minutes' => 5])->assertRedirect();
        $this->actingAs($owner)->delete("/messages/{$chat->id}/members/{$member->username}/restrict")->assertRedirect();
        $this->actingAs($member)->postJson(route('messages.store', $chat), ['body' => 'дякую'])->assertCreated();
    }

    public function test_timed_kick_keeps_person_out_until_it_expires(): void
    {
        [$chat, $owner, $member] = $this->group();
        $this->actingAs($owner)->post("/messages/{$chat->id}/members/{$member->username}/restrict", ['kind' => 'kick', 'minutes' => 1440])->assertRedirect();

        $this->assertNull($chat->participantFor($member));
        $this->actingAs($member)->get("/messages/{$chat->id}")->assertNotFound();
        $this->actingAs($owner)->post("/messages/{$chat->id}/members", ['user_ids' => [$member->id]])->assertSessionHasErrors('user_ids');

        $this->travel(2)->days();
        $this->actingAs($owner)->post("/messages/{$chat->id}/members", ['user_ids' => [$member->id]])->assertSessionHasNoErrors();
        $this->assertNotNull($chat->participantFor($member));
    }

    public function test_admins_cannot_punish_the_owner(): void
    {
        [$chat, $owner, $member] = $this->group();
        $this->actingAs($owner)->post(route('messages.members.role', [$chat, $member]), ['role' => 'admin'])->assertRedirect();

        $this->actingAs($member)->post("/messages/{$chat->id}/members/{$owner->username}/restrict", ['kind' => 'kick', 'minutes' => 60])->assertForbidden();
    }

    public function test_community_admin_kicks_from_channel_for_a_while(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'Клан', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
        $fan = User::factory()->create();
        app(CommunityService::class)->join($community, $fan);
        $channels = app(CommunityChannels::class);
        $channels->bootstrap($community);
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $this->actingAs($fan)->get("/c/{$community->slug}/channels/{$general->id}")->assertOk();
        $this->actingAs($owner)->get("/c/{$community->slug}/channels/{$general->id}")->assertOk();

        $this->actingAs($owner)->post("/messages/{$general->conversation_id}/members/{$fan->username}/restrict", ['kind' => 'kick', 'minutes' => 60])->assertRedirect();

        $this->actingAs($fan)->get("/c/{$community->slug}/channels/{$general->id}")->assertForbidden();
        $this->actingAs($fan)->get("/c/{$community->slug}/channels")->assertRedirect();
        $this->assertFalse($channels->canView($general->fresh(), $fan));
        $this->assertTrue($channels->canView($community->channels()->where('type', CommunityChannel::ANNOUNCEMENT)->firstOrFail(), $fan));

        $this->travel(61)->minutes();
        $this->actingAs($fan)->get("/c/{$community->slug}/channels/{$general->id}")->assertOk();
    }

    public function test_backgrounds_personal_and_shared(): void
    {
        Storage::fake('public');
        [$chat, $owner, $member] = $this->group();

        $this->actingAs($member)->post("/messages/{$chat->id}/background", ['preset' => 'ocean'])->assertRedirect();
        $this->actingAs($member)->post("/messages/{$chat->id}/background", ['preset' => 'aurora', 'for_all' => true])->assertForbidden();
        $this->actingAs($member)->post("/messages/{$chat->id}/background", ['preset' => 'lava'])->assertSessionHasErrors('preset');
        $this->actingAs($owner)->post("/messages/{$chat->id}/background", ['preset' => 'forest', 'for_all' => true])->assertRedirect();

        $this->actingAs($member)->get("/messages/{$chat->id}")->assertInertia(fn (Assert $page) => $page
            ->where('active.background.preset', 'ocean')
            ->where('active.shared_background', 'forest'));
        $this->actingAs($owner)->get("/messages/{$chat->id}")->assertInertia(fn (Assert $page) => $page
            ->where('active.background.preset', 'forest'));

        $this->actingAs($member)->post("/messages/{$chat->id}/background", ['image' => UploadedFile::fake()->image('bg.jpg', 1200, 800)])->assertRedirect();
        $this->actingAs($member)->get("/messages/{$chat->id}")->assertInertia(fn (Assert $page) => $page
            ->where('active.background.preset', null)
            ->where('active.background.image', fn ($url) => str_contains((string) $url, 'chat-backgrounds/')));
    }
}
