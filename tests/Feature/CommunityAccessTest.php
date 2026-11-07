<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Models\Message;
use App\Models\User;
use App\Services\Communities\CommunityChannels;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Каталог спільнот, пароль для вступу, приховування, перегляд гостями, гостьовий чат і автовступ. */
class CommunityAccessTest extends TestCase
{
    use RefreshDatabase;

    private function community(User $owner, string $name = 'Кіберспорт UA', array $data = []): Community
    {
        return app(CommunityService::class)->create($owner, [
            'name' => $name,
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN,
            'category' => 'esports',
            ...$data,
        ]);
    }

    public function test_catalog_is_open_to_guests_and_hides_unlisted(): void
    {
        $owner = User::factory()->create();
        $visible = $this->community($owner, 'Видима');
        $hidden = $this->community($owner, 'Секретна');
        $hidden->update(['is_listed' => false]);

        $this->get('/communities')->assertInertia(fn (Assert $page) => $page
            ->component('communities/index')
            ->where('tab', 'discover')
            ->where('communities.data', fn ($items) => collect($items)->pluck('id')->contains($visible->id)
                && ! collect($items)->pluck('id')->contains($hidden->id)));

        // Учасник бачить приховану серед «Моїх».
        $this->actingAs($owner)->get('/communities?tab=mine')->assertInertia(fn (Assert $page) => $page
            ->where('communities.data', fn ($items) => collect($items)->pluck('id')->contains($hidden->id)));
        $this->actingAs($owner)->getJson('/search/quick?q=Секрет')->assertOk()->assertJsonCount(0, 'communities');
    }

    public function test_sections_show_active_and_growing_communities(): void
    {
        $owner = User::factory()->create();
        $busy = $this->community($owner, 'Жвава');
        $this->community($owner, 'Тиха');
        app(CommunityService::class)->join($busy, User::factory()->create());
        app(CommunityChannels::class)->bootstrap($busy);
        $general = $busy->channels()->where('name', 'загальне')->firstOrFail();
        Message::query()->create(['conversation_id' => $general->conversation_id, 'user_id' => $owner->id, 'type' => 'text', 'body' => 'Привіт']);

        $this->actingAs($owner)->get('/communities?tab=discover')->assertInertia(fn (Assert $page) => $page
            ->where('sections.0.key', 'active')
            ->where('sections.0.items.0.id', $busy->id)
            ->where('sections.0.items.0.active_today', 1)
            ->where('sections.1.key', 'growing')
            ->where('sections.1.items.0.id', $busy->id));

        $this->actingAs($owner)->get('/communities?tab=discover&sort=active')->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'active')
            ->where('sections', [])
            ->where('communities.data.0.id', $busy->id));
    }

    public function test_password_lets_people_in_without_request(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner, 'Клуб', ['privacy' => Community::PRIVACY_CLOSED]);
        $this->actingAs($owner)->put("/c/{$community->slug}/settings/access", [
            'is_listed' => true, 'guest_view' => false, 'password' => 'raid2026',
        ])->assertRedirect();
        $this->assertTrue($community->fresh()->toCard()['has_password']);

        $fan = User::factory()->create();
        $this->actingAs($fan)->post("/c/{$community->slug}/join")->assertSessionHasErrors('password');
        $this->actingAs($fan)->post("/c/{$community->slug}/join", ['password' => 'wrong'])->assertSessionHasErrors('password');
        $this->assertNull($community->membershipFor($fan));
        $this->actingAs($fan)->post("/c/{$community->slug}/join", ['password' => 'raid2026'])->assertSessionHasNoErrors();
        $this->assertTrue($community->membershipFor($fan)->isActive());

        // Прибрали пароль — закрита спільнота знову через заявку.
        $this->actingAs($owner)->put("/c/{$community->slug}/settings/access", [
            'is_listed' => true, 'guest_view' => false, 'clear_password' => true,
        ])->assertRedirect();
        $this->assertNull($community->fresh()->join_password);
    }

    public function test_guests_read_open_channels_and_write_in_guest_chat(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $channels = app(CommunityChannels::class);
        $channels->bootstrap($community);
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $secret = $channels->createChannel($community, ['name' => 'склад', 'type' => CommunityChannel::TEXT, 'is_private' => true]);

        // Поки перегляд вимкнено — гість іде на вхід.
        $this->get("/c/{$community->slug}")->assertRedirect('/login');
        $this->get("/c/{$community->slug}/guest")->assertNotFound();

        $this->actingAs($owner)->put("/c/{$community->slug}/settings/access", [
            'is_listed' => true, 'guest_view' => true, 'guest_chat_channel_id' => $secret->id,
        ])->assertSessionHasErrors('guest_chat_channel_id');
        $this->actingAs($owner)->put("/c/{$community->slug}/settings/access", [
            'is_listed' => true, 'guest_view' => true, 'guest_chat_channel_id' => $general->id,
        ])->assertSessionHasNoErrors();
        auth()->logout();

        $this->get("/c/{$community->slug}")->assertRedirect("/c/{$community->slug}/guest");
        $this->get("/c/{$community->slug}/guest")->assertInertia(fn (Assert $page) => $page
            ->component('communities/guest')
            ->where('channel_id', $general->id)
            ->where('can_write', true)
            ->where('channels', fn ($list) => ! collect($list)->pluck('id')->contains($secret->id)));

        $this->post("/c/{$community->slug}/guest/{$general->id}", ['name' => 'Мандрівник', 'body' => 'Привіт, можна до вас?'])->assertRedirect();
        $message = Message::query()->latest('id')->firstOrFail();
        $this->assertNull($message->user_id);
        $this->assertSame('Мандрівник', $message->meta['guest']['name']);
        $this->assertSame($message->id, $general->conversation->fresh()->last_message_id);

        $this->post("/c/{$community->slug}/guest/{$general->id}", ['name' => 'Спамер', 'body' => 'дешево тут https://spam.example'])->assertSessionHasErrors('body');
        $this->post("/c/{$community->slug}/guest/{$general->id}", ['name' => 'Бот', 'body' => 'hi', 'website' => 'x'])->assertSessionHasErrors('website');
        $news = $community->channels()->where('type', CommunityChannel::ANNOUNCEMENT)->firstOrFail();
        $this->post("/c/{$community->slug}/guest/{$news->id}", ['name' => 'Гість', 'body' => 'а тут?'])->assertForbidden();

        // Учасник бачить повідомлення гостя з позначкою.
        $this->actingAs($owner)->get("/c/{$community->slug}/channels/{$general->id}")->assertInertia(fn (Assert $page) => $page
            ->where('history.messages', fn ($list) => collect($list)->contains(fn ($m) => ($m['guest']['name'] ?? null) === 'Мандрівник')));
    }

    public function test_closed_community_cannot_be_opened_to_guests(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner, 'Закрита', ['privacy' => Community::PRIVACY_CLOSED]);

        $this->actingAs($owner)->put("/c/{$community->slug}/settings/access", [
            'is_listed' => true, 'guest_view' => true,
        ])->assertSessionHasErrors('guest_view');
        $this->assertFalse($community->fresh()->guest_view);
    }

    public function test_new_accounts_auto_join_marked_communities(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $official = $this->community($admin, 'GameCon Official');
        $this->actingAs($admin)->patch("/admin/communities/{$official->id}", ['auto_join' => true])->assertRedirect();
        $this->assertTrue($official->fresh()->auto_join);
        auth()->logout();

        $this->post(route('register.store'), [
            'first_name' => 'Тарас', 'last_name' => 'Шевченко', 'email' => 'taras@example.com',
            'password' => 'password', 'password_confirmation' => 'password',
        ]);
        $user = User::query()->where('email', 'taras@example.com')->firstOrFail();
        $this->assertTrue($official->membershipFor($user)->isActive());
    }
}
