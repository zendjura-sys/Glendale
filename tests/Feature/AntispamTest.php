<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\IpBan;
use App\Models\LoginEvent;
use App\Models\Message;
use App\Models\SpamBlock;
use App\Models\User;
use App\Services\Antispam\IpBans;
use App\Services\Antispam\LinkFilter;
use App\Services\Communities\CommunityChannels;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Антиспам: фільтр доменів, бани за IP і гостей, журнал IP, статистика чатів. */
class AntispamTest extends TestCase
{
    use RefreshDatabase;

    public function test_hosts_are_found_and_file_names_ignored(): void
    {
        $this->assertSame(
            ['example.com', 't.me', 'ok.ua'],
            LinkFilter::hosts('глянь https://www.Example.com/x і t.me/spam, файл tactics.txt та ok.ua! версія 3.5'),
        );
        $this->assertSame(['bit.ly', 'spam.example'], LinkFilter::domains("https://bit.ly/abc\n www.spam.example , нісенітниця"));
    }

    public function test_admin_sets_domain_filter_and_it_stops_messages(): void
    {
        $admin = User::factory()->admin()->create();
        $friend = User::factory()->create(['created_at' => now()->subWeek()]);
        $admin->forceFill(['created_at' => now()->subWeek()])->save();
        app(FriendshipService::class)->request($admin, $friend);
        app(FriendshipService::class)->accept($friend, $admin);
        $chat = app(Messenger::class)->createGroup($admin, 'Рейд', [$friend->id]);

        $this->actingAs($friend)->put('/admin/antispam/links', ['mode' => 'blocklist', 'blocked' => 'x'])->assertForbidden();
        $this->actingAs($admin)->put('/admin/antispam/links', ['mode' => 'blocklist', 'blocked' => "free-skins.example\nhttps://bit.ly/"])
            ->assertSessionHasNoErrors();
        $this->assertSame(['free-skins.example', 'bit.ly'], app(SiteSettings::class)->get('link_filter')['blocked']);

        $this->actingAs($friend)->post("/messages/{$chat->id}", ['body' => 'Халява: https://cs.free-skins.example/drop'])->assertSessionHasErrors('body');
        $this->actingAs($friend)->post("/messages/{$chat->id}", ['body' => 'Трейлер https://youtube.com/watch?v=1'])->assertSessionHasNoErrors();
        $this->assertSame(1, SpamBlock::query()->where('kind', 'domain')->where('detail', 'cs.free-skins.example')->count());

        // «Лише дозволені»: усе інше не проходить.
        $this->actingAs($admin)->put('/admin/antispam/links', ['mode' => 'allowlist', 'blocked' => '', 'allowed' => 'youtube.com'])->assertSessionHasNoErrors();
        $this->actingAs($friend)->post("/messages/{$chat->id}", ['body' => 'Дивись twitch.tv/gamecon'])->assertSessionHasErrors('body');
        $this->actingAs($friend)->post("/messages/{$chat->id}", ['body' => 'А ось m.youtube.com/x і файл demo.cfg'])->assertSessionHasNoErrors();
    }

    public function test_banned_ip_can_read_but_not_write(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();

        $this->actingAs($admin)->post('/admin/antispam/bans', ['ip' => '10.0.0.0/4'])->assertSessionHasErrors('ip');
        $this->actingAs($admin)->post('/admin/antispam/bans', ['ip' => '10.20.0.0/16', 'reason' => 'Ботоферма', 'days' => 7])->assertSessionHasNoErrors();
        $ban = IpBan::query()->firstOrFail();
        $this->assertTrue($ban->expires_at->isFuture());

        $this->actingAs($user)->withServerVariables(['REMOTE_ADDR' => '10.20.5.6'])->get('/feed')->assertOk();
        $this->actingAs($user)->withServerVariables(['REMOTE_ADDR' => '10.20.5.6'])->postJson('/posts', ['body' => 'спам', 'visibility' => 'public'])->assertForbidden();
        $this->assertSame(1, SpamBlock::query()->where('kind', 'ip_ban')->count());
        $this->actingAs($user)->withServerVariables(['REMOTE_ADDR' => '10.21.0.1'])->post('/posts', ['body' => 'Привіт', 'visibility' => 'public'])->assertSessionHasNoErrors()->assertRedirect();

        $this->actingAs($admin)->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])->delete("/admin/antispam/bans/{$ban->id}")->assertRedirect();
        $this->assertNull(app(IpBans::class)->banned('10.20.5.6'));
    }

    public function test_channel_admin_bans_guest_in_community(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'CS2 UA', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
        app(CommunityChannels::class)->bootstrap($community);
        $general = $community->channels()->where('name', 'загальне')->firstOrFail();
        $this->actingAs($owner)->put("/c/{$community->slug}/settings/access", [
            'is_listed' => true, 'guest_view' => true, 'guest_chat_channel_id' => $general->id,
        ])->assertSessionHasNoErrors();
        auth()->logout();

        $guest = fn (string $body) => $this->withServerVariables(['REMOTE_ADDR' => '77.1.2.3'])
            ->post("/c/{$community->slug}/guest/{$general->id}", ['name' => 'Тролль', 'body' => $body]);
        $guest('КУПУЙ АКАУНТИ')->assertRedirect();
        $message = Message::query()->latest('id')->firstOrFail();

        $stranger = User::factory()->create();
        $this->actingAs($stranger)->postJson("/messages/{$general->conversation_id}/messages/{$message->id}/ban-guest", ['days' => 7])->assertForbidden();
        $this->actingAs($owner)->postJson("/messages/{$general->conversation_id}/messages/{$message->id}/ban-guest", ['days' => 7])->assertOk();
        $this->assertSoftDeleted($message);
        $ban = IpBan::query()->firstOrFail();
        $this->assertSame($community->id, $ban->community_id);
        $this->assertNull($ban->ip);
        auth()->logout();

        $guest('я знову тут')->assertSessionHasErrors('body');
        $this->assertSame(1, SpamBlock::query()->where('kind', 'guest_ban')->count());
        // Інший гість пише як і раніше.
        $this->withServerVariables(['REMOTE_ADDR' => '88.1.1.1'])
            ->post("/c/{$community->slug}/guest/{$general->id}", ['name' => 'Гравець', 'body' => 'Привіт усім'])->assertRedirect()->assertSessionHasNoErrors();
    }

    public function test_ip_log_and_chat_stats(): void
    {
        $admin = User::factory()->admin()->create();
        $alice = User::factory()->create(['username' => 'alice']);
        $twin = User::factory()->create(['username' => 'twin']);
        foreach ([[$alice, '5.5.5.5'], [$alice, '5.5.5.5'], [$twin, '5.5.5.5'], [$alice, '6.6.6.6']] as [$user, $ip]) {
            LoginEvent::query()->create(['user_id' => $user->id, 'method' => 'password', 'success' => true, 'ip' => $ip, 'created_at' => now()]);
        }

        $this->actingAs($admin)->get('/admin/antispam?q=@alice')->assertInertia(fn (Assert $page) => $page
            ->component('admin/antispam')
            ->where('log.kind', 'user')
            ->where('log.rows', fn ($rows) => collect($rows)->firstWhere('ip', '5.5.5.5')['others'] === 1
                && collect($rows)->firstWhere('ip', '5.5.5.5')['logins'] === 2));
        $this->actingAs($admin)->get('/admin/antispam?q=5.5.5.0/24')->assertInertia(fn (Assert $page) => $page
            ->where('log.kind', 'ip')->has('log.rows', 2));

        app(FriendshipService::class)->request($alice, $twin);
        app(FriendshipService::class)->accept($twin, $alice);
        $chat = app(Messenger::class)->createGroup($alice, 'Рейд', [$twin->id]);
        app(Messenger::class)->send($chat, $alice, 'Привіт');
        app(Messenger::class)->send($chat, $twin, 'Здоров');
        app(Messenger::class)->sendAsBot($chat, 'Бот', 'Вітаю');

        $this->actingAs($alice)->get('/admin/chats')->assertForbidden();
        $this->actingAs($admin)->get('/admin/chats')->assertInertia(fn (Assert $page) => $page
            ->component('admin/chat-stats')
            ->where('totals.today', 2)
            ->where('totals.bots', 1)
            ->where('top.0.title', 'Рейд')
            ->where('top.0.members', 2)
            ->has('series', 30));
    }
}
