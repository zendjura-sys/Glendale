<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Models\GtaServer;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\Post;
use App\Models\User;
use App\Services\Families\FamilyService;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ModerationTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;

    private User $bob;

    private Conversation $chat;

    protected function setUp(): void
    {
        parent::setUp();
        $this->alice = User::factory()->create(['created_at' => now()->subDays(10)]);
        $this->bob = User::factory()->create(['created_at' => now()->subDays(10)]);
        $friendships = app(FriendshipService::class);
        $friendships->request($this->alice, $this->bob);
        $friendships->accept($this->bob, $this->alice);
        $this->chat = app(Messenger::class)->direct($this->alice, $this->bob);
    }

    private function say(User $user, string $body): TestResponse
    {
        return $this->actingAs($user)->postJson(route('messages.store', $this->chat), ['body' => $body]);
    }

    public function test_profanity_is_masked_in_messages_posts_and_comments_or_blocked(): void
    {
        $this->say($this->alice, 'Ну ти сука, але сукня гарна')->assertCreated();
        $this->assertSame('Ну ти с***, але сукня гарна', Message::query()->latest('id')->value('body'));

        $this->actingAs($this->alice)->post(route('posts.store'), ['body' => 'Це пиздец', 'visibility' => 'public']);
        $this->assertSame('Це п*****', Post::query()->latest('id')->value('body'));

        app(SiteSettings::class)->put(['moderation' => ['profanity' => 'block']]);
        $this->say($this->alice, 'блять')->assertUnprocessable()->assertJsonValidationErrors('body');
    }

    public function test_flood_repeats_and_links_from_new_accounts_are_stopped(): void
    {
        app(SiteSettings::class)->put(['moderation' => ['flood_limit' => 50, 'repeat_limit' => 2, 'new_account_link_hours' => 24]]);
        $this->say($this->alice, 'Купи монети')->assertCreated();
        $this->say($this->alice, 'Купи монети')->assertCreated();
        $this->say($this->alice, 'Купи монети')->assertUnprocessable();

        $newbie = User::factory()->create();
        $friendships = app(FriendshipService::class);
        $friendships->request($newbie, $this->bob);
        $friendships->accept($this->bob, $newbie);
        $chat = app(Messenger::class)->direct($newbie, $this->bob);
        $this->actingAs($newbie)->postJson(route('messages.store', $chat), ['body' => 'Заходь https://scam.example/free'])->assertUnprocessable();
        // Посилання на сам GameCon — можна.
        $this->actingAs($newbie)->postJson(route('messages.store', $chat), ['body' => 'Дивись '.url('/watch/abc')])->assertCreated();

        app(SiteSettings::class)->put(['moderation' => ['flood_limit' => 2]]);
        $this->say($this->bob, 'раз')->assertCreated();
        $this->say($this->bob, 'два')->assertCreated();
        $this->say($this->bob, 'три')->assertUnprocessable();
    }

    public function test_report_goes_to_admin_who_deletes_message_and_mutes_author(): void
    {
        $this->say($this->bob, 'Ти лох')->assertCreated();
        $message = Message::query()->latest('id')->sole();

        $this->actingAs($this->bob)->postJson(route('messages.messages.report', [$this->chat, $message]), ['reason' => 'abuse'])->assertUnprocessable();
        $this->actingAs($this->alice)->postJson(route('messages.messages.report', [$this->chat, $message]), ['reason' => 'abuse', 'comment' => 'Образи'])->assertOk();
        $stranger = User::factory()->create();
        $this->actingAs($stranger)->postJson(route('messages.messages.report', [$this->chat, $message]), ['reason' => 'abuse'])->assertForbidden();

        $admin = User::factory()->admin()->create();
        $this->actingAs($this->alice)->get(route('admin.moderation.index'))->assertForbidden();
        $this->actingAs($admin)->get(route('admin.moderation.index'))->assertOk();

        $report = MessageReport::query()->sole();
        $this->actingAs($admin)->post(route('admin.moderation.resolve', $report), ['action' => 'mute', 'hours' => 24])->assertSessionHasNoErrors();

        $this->assertSoftDeleted($message);
        $this->assertSame(MessageReport::RESOLVED, $report->fresh()?->status);
        $this->assertTrue($this->bob->fresh()?->isMuted());
        $this->say($this->bob->fresh(), 'Привіт')->assertUnprocessable()->assertJsonValidationErrors('body');

        $this->actingAs($admin)->post(route('admin.moderation.unmute', $this->bob))->assertSessionHasNoErrors();
        $this->say($this->bob->fresh(), 'Привіт')->assertCreated();
    }

    public function test_family_mute_blocks_only_family_chat(): void
    {
        $server = GtaServer::query()->create(['slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $family = app(FamilyService::class)->create($this->alice, ['server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001']);
        $member = $family->members()->create(['user_id' => $this->bob->id, 'rp_nickname' => 'Tony_Moretti', 'static_id' => '20002', 'rank' => 1, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now()]);
        $familyChat = Conversation::query()->create(['type' => Conversation::TYPE_GROUP, 'title' => 'SCL', 'owner_id' => $this->alice->id, 'family_id' => $family->id]);
        foreach ([$this->alice, $this->bob] as $u) {
            $familyChat->participants()->create(['user_id' => $u->id, 'role' => 'member', 'joined_at' => now()]);
        }
        FamilyPunishment::query()->create(['family_id' => $family->id, 'member_id' => $member->id, 'type' => FamilyPunishment::TYPE_MUTE, 'reason' => 'Флуд', 'expires_at' => now()->addHours(3)]);

        $this->actingAs($this->bob)->postJson(route('messages.store', $familyChat), ['body' => 'Привіт сім’я'])->assertUnprocessable();
        $this->say($this->bob, 'А тут можна')->assertCreated();
    }
}
