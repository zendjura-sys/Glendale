<?php

namespace Tests\Feature;

use App\Models\ChatAutomation;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Chat\ChatBots;
use App\Services\Communities\CommunityChannels;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Вітальний бот і автопости за розкладом у групах і каналах спільнот. */
class ChatBotsTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: Conversation, 1: User, 2: User, 3: User} */
    private function group(): array
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $newbie = User::factory()->create(['first_name' => 'Тарас', 'last_name' => 'Новак']);
        $friends = app(FriendshipService::class);
        foreach ([$member, $newbie] as $friend) {
            $friends->request($owner, $friend);
            $friends->accept($friend, $owner);
        }

        return [app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]), $owner, $member, $newbie];
    }

    public function test_welcome_bot_greets_new_members_once(): void
    {
        [$chat, $owner, $member, $newbie] = $this->group();

        $this->actingAs($member)->putJson("/messages/{$chat->id}/bots/welcome", ['enabled' => true, 'body' => 'Привіт'])->assertForbidden();
        $this->actingAs($owner)->putJson("/messages/{$chat->id}/bots/welcome", [
            'enabled' => true, 'bot_name' => 'Сторож', 'body' => 'Вітаємо, {name}, у «{chat}»!',
        ])->assertOk()->assertJsonPath('welcome.bot_name', 'Сторож');

        $this->actingAs($owner)->post("/messages/{$chat->id}/members", ['user_ids' => [$newbie->id]])->assertRedirect();
        $last = $chat->messages()->latest('id')->firstOrFail();
        $this->assertNull($last->user_id);
        $this->assertSame('Сторож', $last->meta['bot']['name']);
        $this->assertSame("Вітаємо, {$newbie->name}, у «Рейд»!", $last->body);

        // Вийшов і повернувся — вдруге не вітаємо.
        app(Messenger::class)->removeMember($chat, $newbie, $newbie);
        $count = $chat->messages()->whereNotNull('meta->bot')->count();
        $this->actingAs($owner)->post("/messages/{$chat->id}/members", ['user_ids' => [$newbie->id]])->assertRedirect();
        $this->assertSame($count, $chat->messages()->whereNotNull('meta->bot')->count());

        $this->actingAs($member)->getJson("/messages/{$chat->id}")->assertOk();
    }

    public function test_community_channel_greets_new_members(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'Клан', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
        app(CommunityChannels::class)->bootstrap($community);
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $this->actingAs($owner)->get("/c/{$community->slug}/channels/{$general->id}")->assertOk();
        $this->actingAs($owner)->putJson("/messages/{$general->conversation_id}/bots/welcome", ['enabled' => true, 'body' => 'Ласкаво просимо, {name}!'])->assertOk();

        $fan = User::factory()->create();
        app(CommunityService::class)->join($community, $fan);
        $this->assertSame("Ласкаво просимо, {$fan->name}!", $general->conversation->messages()->latest('id')->value('body'));
    }

    public function test_autoposts_run_on_schedule(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 10:00', 'Europe/Kyiv'));
        [$chat, $owner] = $this->group();

        $this->actingAs($owner)->postJson("/messages/{$chat->id}/bots/posts", [
            'body' => 'Щоденний збір о 20:00', 'repeat' => 'daily', 'time' => '20:00',
        ])->assertCreated();
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/bots/posts", [
            'body' => 'Турнір у п’ятницю', 'repeat' => 'weekly', 'time' => '18:30', 'weekdays' => [5],
        ])->assertCreated();
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/bots/posts", [
            'body' => 'Разове нагадування', 'repeat' => 'once', 'at' => '2026-10-27 12:00',
        ])->assertCreated();
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/bots/posts", [
            'body' => 'У минуле', 'repeat' => 'once', 'at' => '2026-10-26 12:00',
        ])->assertUnprocessable();
        $this->actingAs($owner)->postJson("/messages/{$chat->id}/bots/posts", [
            'body' => 'Без днів', 'repeat' => 'weekly', 'time' => '18:30', 'weekdays' => [],
        ])->assertUnprocessable();

        $daily = ChatAutomation::query()->where('body', 'Щоденний збір о 20:00')->firstOrFail();
        $this->assertSame('2026-10-27 20:00', $daily->next_run_at->timezone('Europe/Kyiv')->format('Y-m-d H:i'));
        $weekly = ChatAutomation::query()->where('body', 'Турнір у п’ятницю')->firstOrFail();
        $this->assertSame('2026-10-30 18:30', $weekly->next_run_at->timezone('Europe/Kyiv')->format('Y-m-d H:i'));

        $bots = app(ChatBots::class);
        $this->assertSame(0, $bots->runDue());
        Carbon::setTestNow(Carbon::parse('2026-10-27 12:01', 'Europe/Kyiv'));
        $this->assertSame(1, $bots->runDue());
        $this->assertSame('Разове нагадування', $chat->messages()->latest('id')->value('body'));
        $this->assertFalse(ChatAutomation::query()->where('body', 'Разове нагадування')->value('enabled'));

        Carbon::setTestNow(Carbon::parse('2026-10-27 20:00', 'Europe/Kyiv'));
        $this->artisan('chat:autopost')->assertSuccessful();
        $this->assertSame('Щоденний збір о 20:00', $chat->messages()->latest('id')->value('body'));
        $this->assertSame('2026-10-28 20:00', $daily->fresh()->next_run_at->timezone('Europe/Kyiv')->format('Y-m-d H:i'));

        // Вимкнений автопост мовчить.
        $this->actingAs($owner)->patchJson("/messages/{$chat->id}/bots/posts/{$daily->id}", ['enabled' => false])->assertOk();
        Carbon::setTestNow(Carbon::parse('2026-10-28 20:00', 'Europe/Kyiv'));
        $this->assertSame(0, $bots->runDue());

        $this->actingAs($owner)->deleteJson("/messages/{$chat->id}/bots/posts/{$daily->id}")->assertOk()->assertJsonCount(2, 'posts');
        Carbon::setTestNow();
    }
}
