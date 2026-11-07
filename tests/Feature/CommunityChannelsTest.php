<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Services\Communities\CommunityChannels;
use App\Services\CommunityService;
use App\Services\Voice\VoiceRooms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Канали спільноти: стартові канали, приватні, «Оголошення», порядок, голосові, вихід зі спільноти. */
class CommunityChannelsTest extends TestCase
{
    use RefreshDatabase;

    private function community(User $owner): Community
    {
        return app(CommunityService::class)->create($owner, [
            'name' => 'Кіберспорт UA',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN,
            'category' => 'esports',
        ]);
    }

    private function member(Community $community): User
    {
        $user = User::factory()->create();
        app(CommunityService::class)->join($community, $user);

        return $user;
    }

    public function test_first_visit_creates_default_channels_and_opens_general(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $fan = $this->member($community);

        $general = null;
        $this->actingAs($fan)->get("/c/{$community->slug}/channels")->assertRedirect();
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $this->assertSame(3, $community->channels()->count());
        $this->assertTrue($community->channels()->where('type', CommunityChannel::VOICE)->exists());

        $this->actingAs($fan)->get("/c/{$community->slug}/channels/{$general->id}")->assertInertia(fn (Assert $page) => $page
            ->component('communities/channels')
            ->where('joined', true)
            ->where('can_manage', false)
            ->where('channel.name', 'загальне')
            ->where('active.can_write', true)
            ->has('tree.categories', 2));

        // Бесіда каналу не з’являється у вхідних і не додає непрочитаних.
        $this->actingAs($fan)->post("/messages/{$general->conversation_id}", ['body' => 'Привіт усім'])->assertRedirect();
        $this->actingAs($owner)->get('/messages')->assertInertia(fn (Assert $page) => $page
            ->where('conversations', fn ($list) => collect($list)->doesntContain('id', $general->conversation_id)));
    }

    public function test_outsiders_do_not_see_channels(): void
    {
        $community = $this->community(User::factory()->create());
        app(CommunityChannels::class)->bootstrap($community);
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $stranger = User::factory()->create();

        $this->actingAs($stranger)->get("/c/{$community->slug}/channels")->assertInertia(fn (Assert $page) => $page
            ->where('joined', false)->has('tree.categories', 0));
        $this->actingAs($stranger)->get("/c/{$community->slug}/channels/{$general->id}")->assertForbidden();
    }

    public function test_only_admins_write_to_announcements(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $fan = $this->member($community);
        app(CommunityChannels::class)->bootstrap($community);
        $news = $community->channels()->where('type', CommunityChannel::ANNOUNCEMENT)->firstOrFail();

        $this->actingAs($fan)->get("/c/{$community->slug}/channels/{$news->id}")->assertInertia(fn (Assert $page) => $page
            ->where('active.can_write', false)
            ->where('active.locked_text', 'В оголошеннях пишуть лише адміністратори спільноти.'));
        $this->actingAs($fan)->post("/messages/{$news->conversation_id}", ['body' => 'Можна?'])->assertForbidden();

        $this->actingAs($owner)->get("/c/{$community->slug}/channels/{$news->id}");
        $this->actingAs($owner)->post("/messages/{$news->conversation_id}", ['body' => 'Турнір у суботу!'])->assertRedirect();
        $this->assertSame('Турнір у суботу!', $news->conversation->messages()->latest('id')->value('body'));
    }

    public function test_admin_manages_private_channels_and_order(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $invited = $this->member($community);
        $other = $this->member($community);

        $this->actingAs($other)->post("/c/{$community->slug}/channels", ['name' => 'хак', 'type' => 'text'])->assertForbidden();
        $this->actingAs($owner)->post("/c/{$community->slug}/channel-categories", ['name' => 'Склад'])->assertRedirect();
        $category = $community->channelCategories()->where('name', 'Склад')->firstOrFail();
        $this->actingAs($owner)->post("/c/{$community->slug}/channels", [
            'name' => 'тактика', 'type' => 'text', 'category_id' => $category->id, 'topic' => 'Лише для складу',
            'is_private' => true, 'members' => [$invited->id],
        ])->assertRedirect();
        $secret = $community->channels()->where('name', 'тактика')->firstOrFail();
        $this->assertTrue($secret->is_private);

        $this->actingAs($invited)->get("/c/{$community->slug}/channels/{$secret->id}")->assertOk();
        $this->actingAs($other)->get("/c/{$community->slug}/channels/{$secret->id}")->assertForbidden();
        $this->actingAs($other)->post("/messages/{$secret->conversation_id}", ['body' => 'ой'])->assertNotFound();

        // Прибрали з приватного каналу — бесіда для нього закрита.
        $this->actingAs($owner)->patch("/c/{$community->slug}/channels/{$secret->id}", ['members' => []])->assertRedirect();
        $this->assertNotNull(ConversationParticipant::query()->where('conversation_id', $secret->conversation_id)->where('user_id', $invited->id)->value('left_at'));

        $ids = $community->channels()->orderBy('position')->pluck('id')->all();
        $this->actingAs($owner)->put("/c/{$community->slug}/channels/order", [
            'categories' => [$category->id],
            'groups' => [['category_id' => $category->id, 'channels' => array_reverse($ids)]],
        ])->assertRedirect();
        $this->assertSame(array_reverse($ids), $community->channels()->orderBy('position')->pluck('id')->all());
        $this->assertSame([$category->id], $community->channels()->distinct()->pluck('category_id')->all());

        $this->actingAs($owner)->delete("/c/{$community->slug}/channels/{$secret->id}")->assertSessionHasNoErrors()->assertRedirect();
        $this->assertModelMissing($secret);
    }

    public function test_last_text_channel_cannot_be_deleted(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        app(CommunityChannels::class)->bootstrap($community);
        [$first, $second] = $community->channels()->where('type', '!=', CommunityChannel::VOICE)->get()->all();

        $this->actingAs($owner)->delete("/c/{$community->slug}/channels/{$first->id}")->assertRedirect();
        $this->actingAs($owner)->delete("/c/{$community->slug}/channels/{$second->id}")->assertStatus(422);
    }

    public function test_private_voice_channel_and_leaving_the_community(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $fan = $this->member($community);
        $channels = app(CommunityChannels::class);
        $voice = $channels->createChannel($community, ['name' => 'Штаб', 'type' => CommunityChannel::VOICE, 'is_private' => true]);
        $room = $voice->voiceRoom;

        $this->assertFalse(app(VoiceRooms::class)->canEnter($fan, $room));
        $this->actingAs($owner)->get("/c/{$community->slug}/channels/{$voice->id}")->assertInertia(fn (Assert $page) => $page
            ->where('channel.type', CommunityChannel::VOICE)->where('active', null));
        $this->assertTrue(app(VoiceRooms::class)->canEnter($owner, $room));

        $channels->bootstrap($community);
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $this->actingAs($fan)->get("/c/{$community->slug}/channels/{$general->id}")->assertOk();
        $this->assertDatabaseHas('conversation_participants', ['conversation_id' => $general->conversation_id, 'user_id' => $fan->id, 'left_at' => null]);

        app(CommunityService::class)->leave($community, $fan);
        $this->assertNotNull(ConversationParticipant::query()->where('conversation_id', $general->conversation_id)->where('user_id', $fan->id)->value('left_at'));
        $this->actingAs($fan)->post("/messages/{$general->conversation_id}", ['body' => 'я тут?'])->assertNotFound();
    }
}
