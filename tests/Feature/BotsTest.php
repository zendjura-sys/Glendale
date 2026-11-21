<?php

namespace Tests\Feature;

use App\Models\BotLink;
use App\Models\DiscordRoleGrant;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\MusicStatus;
use App\Models\User;
use App\Services\Bots\BotHub;
use App\Services\Families\FamilyService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BotsTest extends TestCase
{
    use RefreshDatabase;

    private string $tgSecret = '';

    /**
     * @return array{Family, User, User}
     */
    private function family(): array
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $leader = User::factory()->create(['discord_id' => '100000000000000001']);
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $player = User::factory()->create(['discord_id' => '100000000000000002']);
        $family->members()->create([
            'user_id' => $player->id, 'rp_nickname' => 'Tony_Moretti', 'static_id' => '20002',
            'rank' => 3, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now(),
        ]);

        return [$family, $leader, $player];
    }

    private function telegram(): void
    {
        $settings = app(SiteSettings::class);
        $settings->putSecret('telegram_bot_token', '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
        $settings->put(['telegram_bot_username' => 'GameConBot']);
        $settings->putSecret('telegram_webhook_secret', $this->tgSecret = 'tg-secret-123');
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]])]);
    }

    private function update(array $payload, ?string $secret = null)
    {
        return $this->postJson('/api/bots/telegram', $payload, ['X-Telegram-Bot-Api-Secret-Token' => $secret ?? $this->tgSecret]);
    }

    private function codeFrom(string $location, string $param): string
    {
        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        return (string) $query[$param];
    }

    public function test_telegram_group_is_linked_by_button_and_members_rsvp_with_buttons(): void
    {
        $this->telegram();
        [$family, $leader, $player] = $this->family();

        $this->actingAs($player)->post("/bots/family/{$family->id}/telegram")->assertForbidden();
        $location = $this->actingAs($leader)->post("/bots/family/{$family->id}/telegram")->assertRedirect()->headers->get('Location');
        $this->assertStringStartsWith('https://t.me/GameConBot?startgroup=', (string) $location);
        $code = $this->codeFrom((string) $location, 'startgroup');

        $this->update(['message' => ['chat' => ['id' => -1001, 'type' => 'supergroup', 'title' => 'SCL'], 'from' => ['id' => 5], 'text' => "/start@GameConBot {$code}"]], 'wrong')->assertForbidden();
        $this->update(['message' => ['chat' => ['id' => -1001, 'type' => 'supergroup', 'title' => 'SCL'], 'from' => ['id' => 5], 'text' => "/start@GameConBot {$code}"]])->assertOk();
        $link = BotLink::query()->sole();
        $this->assertSame('-1001', $link->chat_id);
        // Панель із кнопками — без команд.
        Http::assertSent(fn (ClientRequest $r) => str_ends_with($r->url(), '/sendMessage')
            && $r['chat_id'] === '-1001'
            && collect($r['reply_markup']['inline_keyboard'])->flatten(1)->contains(fn ($b) => ($b['callback_data'] ?? null) === "ev:f:{$family->id}"));

        // Гравець прив’язує свій Telegram з налаштувань акаунта.
        $location = $this->actingAs($player)->post('/bots/telegram/account')->assertRedirect()->headers->get('Location');
        $this->update(['message' => ['chat' => ['id' => 77, 'type' => 'private'], 'from' => ['id' => 77, 'username' => 'tony'], 'text' => '/start '.$this->codeFrom((string) $location, 'start')]])->assertOk();
        $this->assertSame('77', $player->fresh()->telegram_id);

        // Нова подія — картка з «Піду / Не піду» в групу.
        $event = FamilyEvent::query()->create(['family_id' => $family->id, 'title' => 'Збори', 'starts_at' => now()->addDay(), 'status' => FamilyEvent::STATUS_PLANNED]);
        $rsvp = "r:f:{$family->id}:{$event->id}:1";
        Http::assertSent(fn (ClientRequest $r) => str_ends_with($r->url(), '/sendMessage')
            && str_contains((string) $r['text'], 'Збори')
            && collect($r['reply_markup']['inline_keyboard'])->flatten(1)->contains(fn ($b) => ($b['callback_data'] ?? null) === $rsvp));

        // Незнайома людина натискає — запису немає; гравець — записаний.
        $this->update(['callback_query' => ['id' => 'q1', 'from' => ['id' => 999], 'data' => $rsvp, 'message' => ['message_id' => 9, 'chat' => ['id' => -1001, 'type' => 'supergroup']]]])->assertOk();
        $this->assertSame(0, FamilyEventAttendance::query()->count());
        $this->update(['callback_query' => ['id' => 'q2', 'from' => ['id' => 77], 'data' => $rsvp, 'message' => ['message_id' => 9, 'chat' => ['id' => -1001, 'type' => 'supergroup']]]])->assertOk();
        $this->assertSame(FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::query()->sole()->status);
        Http::assertSent(fn (ClientRequest $r) => str_ends_with($r->url(), '/answerCallbackQuery') && ($r['callback_query_id'] ?? null) === 'q2' && str_contains((string) ($r['text'] ?? ''), 'Записали'));
        Http::assertSent(fn (ClientRequest $r) => str_ends_with($r->url(), '/editMessageText') && str_contains((string) $r['text'], 'Йдуть:</b> 1'));

        // Бота видалили з групи — зв’язок зникає.
        $this->update(['my_chat_member' => ['chat' => ['id' => -1001], 'new_chat_member' => ['status' => 'kicked']]])->assertOk();
        $this->assertSame(0, BotLink::query()->count());
    }

    public function test_discord_server_channel_buttons_and_roles(): void
    {
        [$family, $leader, $player] = $this->family();
        $keys = sodium_crypto_sign_keypair();
        $settings = app(SiteSettings::class);
        $settings->put(['discord_client_id' => '111111111111111111', 'discord_public_key' => bin2hex(sodium_crypto_sign_publickey($keys))]);
        $settings->putSecret('discord_client_secret', 'secretsecretsecretsecret');
        $settings->putSecret('discord_bot_token', str_repeat('a', 60));
        Http::fake([
            'discord.com/api/v10/oauth2/token' => Http::response(['access_token' => 'x', 'guild' => ['id' => '222222222222222222', 'name' => 'SCL Discord']]),
            'discord.com/api/v10/guilds/222222222222222222/channels' => Http::response([['id' => '333333333333333333', 'name' => 'новини', 'type' => 0], ['id' => '444444444444444444', 'name' => 'Голос', 'type' => 2]]),
            'discord.com/api/v10/guilds/222222222222222222/roles' => Http::response([['id' => '222222222222222222', 'name' => '@everyone'], ['id' => '555555555555555555', 'name' => 'SCL']]),
            'discord.com/api/v10/channels/*' => Http::response(['id' => '9']),
            'discord.com/api/v10/guilds/222222222222222222/members/*' => Http::response('', 204),
            'discord.com/api/v10/webhooks/*' => Http::response(['id' => '1']),
        ]);

        $location = (string) $this->actingAs($leader)->post("/bots/family/{$family->id}/discord")->assertRedirect()->headers->get('Location');
        $this->assertStringContainsString('discord.com/oauth2/authorize', $location);
        $state = $this->codeFrom($location, 'state');
        // guild_id з адреси ігноруємо — сервер беремо з обміну коду.
        $this->actingAs($leader)->get(route('bots.discord.callback', ['state' => $state, 'code' => 'abc', 'guild_id' => '999']))->assertRedirect('/f/'.$family->slug.'/settings');
        $link = BotLink::query()->sole();
        $this->assertSame('222222222222222222', $link->guild_id);

        $this->actingAs($leader)->getJson("/bots/family/{$family->id}")->assertOk()
            ->assertJsonPath('discord.link.channels', [['id' => '333333333333333333', 'name' => '#новини']])
            ->assertJsonPath('discord.linked', 2);
        $this->actingAs($leader)->patch(route('bots.update', $link), ['channel_id' => '444444444444444444'])->assertStatus(422);
        $this->actingAs($leader)->patch(route('bots.update', $link), ['channel_id' => '333333333333333333', 'member_role_id' => '555555555555555555'])->assertRedirect();
        Http::assertSent(fn (ClientRequest $r) => str_ends_with($r->url(), '/channels/333333333333333333/messages') && ($r['components'][0]['components'][0]['custom_id'] ?? null) === "ev:f:{$family->id}");
        $this->assertSame(2, DiscordRoleGrant::query()->count());

        // Кнопка «Піду» в Discord: підпис перевіряється, картка оновлюється для всіх.
        $event = FamilyEvent::query()->create(['family_id' => $family->id, 'title' => 'Бізвар', 'starts_at' => now()->addDay(), 'status' => FamilyEvent::STATUS_PLANNED]);
        $send = function (array $payload, bool $valid = true) use ($keys) {
            $body = json_encode($payload);
            $time = (string) time();
            $sig = bin2hex(sodium_crypto_sign_detached($time.$body, sodium_crypto_sign_secretkey($keys)));

            return $this->call('POST', '/api/bots/discord/interactions', [], [], [], [
                'HTTP_X_SIGNATURE_ED25519' => $valid ? $sig : str_repeat('0', 128),
                'HTTP_X_SIGNATURE_TIMESTAMP' => $time,
                'CONTENT_TYPE' => 'application/json',
            ], $body);
        };
        $send(['type' => 1], false)->assertStatus(401);
        $send(['type' => 1])->assertOk()->assertJsonPath('type', 1);
        $send(['type' => 3, 'token' => 'tok', 'member' => ['user' => ['id' => '100000000000000002']], 'data' => ['custom_id' => "r:f:{$family->id}:{$event->id}:1"]])
            ->assertOk()->assertJsonPath('type', 7)->assertJsonPath('data.embeds.0.title', '📅 Бізвар');
        $this->assertSame(FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::query()->sole()->status);
        $send(['type' => 3, 'token' => 'tok', 'member' => ['user' => ['id' => '5']], 'data' => ['custom_id' => "me:f:{$family->id}"]])
            ->assertOk()->assertJsonPath('type', 4)->assertJsonPath('data.flags', 64)->assertJsonPath('data.embeds.0.title', '🔗 Прив’яжіть акаунт GameCon');

        // Гравець вийшов із сім’ї — роль, яку видав бот, забирається.
        FamilyMember::query()->where('user_id', $player->id)->update(['status' => FamilyMember::STATUS_LEFT]);
        $this->artisan('bots:roles')->assertSuccessful();
        $this->assertSame(1, DiscordRoleGrant::query()->count());
        Http::assertSent(fn (ClientRequest $r) => $r->method() === 'DELETE' && str_contains($r->url(), '/members/100000000000000002/roles/555555555555555555'));
    }

    public function test_bot_shows_who_listens_and_announces_listen_rooms(): void
    {
        [$family, $leader, $player] = $this->family();
        $this->telegram();
        BotLink::query()->create(['platform' => BotLink::TELEGRAM, 'owner_type' => 'family', 'owner_id' => $family->id, 'chat_id' => '-100500', 'title' => 'Чат сім’ї', 'linked_by' => $leader->id]);
        MusicStatus::query()->create(['user_id' => $player->id, 'source' => 'spotify', 'payload' => ['title' => 'Thunderstruck', 'artist' => 'AC/DC'], 'expires_at' => now()->addMinutes(5)]);

        $card = app(BotHub::class)->press('telegram', "mu:f:{$family->id}", null)['card'];
        $this->assertStringContainsString('Thunderstruck', implode("\n", $card['lines']));

        // Хто приховав «Зараз слухаю» — не потрапляє в картку.
        $player->forceFill(['preferences' => [...(array) $player->preferences, 'show_listening' => false]])->save();
        Cache::flush();
        $card = app(BotHub::class)->press('telegram', "mu:f:{$family->id}", null)['card'];
        $this->assertSame(['Зараз ніхто не слухає музику.'], $card['lines']);

        // Відкрили кімнату групи — бот пише в чат.
        $this->actingAs($leader)->post('/music/rooms', ['group_type' => 'family', 'group_id' => $family->id, 'title' => 'Вечір року'])->assertRedirect();
        Http::assertSent(fn (ClientRequest $r) => str_contains($r->url(), 'sendMessage') && str_contains((string) json_encode($r->data(), JSON_UNESCAPED_UNICODE), 'Вечір року'));
    }
}
