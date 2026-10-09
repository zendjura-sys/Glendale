<?php

namespace Tests\Feature;

use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\User;
use App\Services\Families\FamilyService;
use App\Services\Games\GameCatalog;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AutoEventsTest extends TestCase
{
    use RefreshDatabase;

    private function igdb(): void
    {
        $settings = app(SiteSettings::class);
        $settings->put(['igdb_client_id' => str_repeat('a', 30)]);
        $settings->putSecret('igdb_client_secret', str_repeat('b', 30));
    }

    public function test_igdb_showcases_and_releases_land_in_game_calendar_and_game_page(): void
    {
        app(GameCatalog::class)->seed();
        $cs = Game::query()->where('slug', 'counter-strike-2')->sole();
        $cs->update(['igdb_id' => 1942]);
        $this->igdb();
        $showAt = now()->addDays(3)->setTime(18, 0)->getTimestamp();
        $releaseAt = now()->addDays(10)->startOfDay()->getTimestamp();
        Http::preventStrayRequests();
        Http::fake([
            'id.twitch.tv/oauth2/token' => Http::response(['access_token' => 'tok', 'expires_in' => 5000000]),
            'api.igdb.com/v4/events' => Http::sequence()
                ->push([['id' => 55, 'name' => 'Summer Game Fest', 'description' => 'Великий шоукейс', 'start_time' => $showAt, 'live_stream_url' => 'https://www.twitch.tv/summergamefest', 'event_logo' => ['image_id' => 'abc123'], 'games' => [1942, 99999]]])
                ->push([]),
            'api.igdb.com/v4/release_dates' => Http::sequence()
                ->push([['game' => 1942, 'date' => $releaseAt, 'platform' => 6], ['game' => 1942, 'date' => $releaseAt, 'platform' => 48]])
                ->push([]),
        ]);

        $this->artisan('events:sync --games')->assertSuccessful();

        $show = GameEvent::query()->where('external_id', 'e55')->sole();
        $this->assertSame('stream', $show->type);
        $this->assertSame([$cs->id], $show->games()->pluck('games.id')->all());
        $release = GameEvent::query()->where('type', 'release')->sole();
        $this->assertTrue($release->all_day);
        $this->assertStringContainsString('ПК', (string) $release->description);

        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/events?kind=game')->assertOk()
            ->assertJsonCount(2, 'events')
            ->assertJsonPath('events.0.title', 'Summer Game Fest')
            ->assertJsonPath('events.0.url', 'https://www.twitch.tv/summergamefest')
            ->assertJsonPath('events.0.games.0.url', '/games/counter-strike-2')
            ->assertJsonPath('events.1.all_day', true);
        // У загальній стрічці — шоукейс; вихід — лише для тих, хто грає в цю гру.
        $this->actingAs($user)->getJson('/events')->assertOk()->assertJsonCount(1, 'events');

        $this->actingAs($user)->post('/events/game/'.$release->id.'/rsvp', ['going' => true])->assertSessionHasNoErrors();
        $this->actingAs($user)->getJson('/events')->assertOk()->assertJsonCount(2, 'events');
        $this->actingAs($user)->getJson(route('games.show', $cs))->assertOk()->assertJsonCount(2, 'events')->assertJsonPath('can_add_event', false);

        // Наступний прохід: IGDB більше не має цих подій — прибираємо з календаря.
        $this->artisan('events:sync --games')->assertSuccessful();
        $this->assertSame(0, GameEvent::query()->count());

        // Вимкнено в Адмінці → Ігри — нічого не тягнемо.
        app(SiteSettings::class)->put(['games_features' => ['events' => false, 'release_events' => false]]);
        $this->artisan('events:sync --games')->assertSuccessful();
        Http::assertSentCount(5);
    }

    public function test_staff_adds_official_game_event(): void
    {
        app(GameCatalog::class)->seed();
        $cs = Game::query()->where('slug', 'counter-strike-2')->sole();
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();
        $payload = ['title' => 'Турнір GameCon', 'type' => 'tournament', 'starts_at' => now()->addDays(2)->format('Y-m-d\TH:i')];

        $this->actingAs($user)->post('/events/game/'.$cs->slug, $payload)->assertForbidden();
        $this->actingAs($admin)->post('/events/game/'.$cs->slug, $payload)->assertSessionHasNoErrors();
        $this->actingAs($admin)->getJson(route('games.show', $cs))->assertJsonPath('events.0.title', 'Турнір GameCon')
            ->assertJsonPath('events.0.host', 'GameCon')->assertJsonPath('events.0.can_delete', true)->assertJsonPath('can_add_event', true);
    }

    public function test_discord_scheduled_events_of_project_are_imported_to_server_calendar(): void
    {
        app(SiteSettings::class)->putSecret('discord_bot_token', 'MTA'.str_repeat('x', 60));
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed', 'discord_invite' => 'https://discord.gg/quant',
        ]);
        GtaServer::query()->create([
            'slug' => 'no-bot', 'name' => 'No Bot RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed', 'discord_invite' => 'nobot',
        ]);
        $start = now()->addDays(2)->utc()->format('Y-m-d\TH:i:s+00:00');
        Http::preventStrayRequests();
        Http::fake([
            'discord.com/api/v10/invites/quant*' => Http::response(['guild' => ['id' => '111111111111111111', 'name' => 'Quant']]),
            'discord.com/api/v10/invites/nobot*' => Http::response(['guild' => ['id' => '222222222222222222', 'name' => 'No bot']]),
            'discord.com/api/v10/guilds/111111111111111111/scheduled-events*' => Http::sequence()
                ->push([
                    ['id' => '900', 'name' => 'Гонки на Vinewood', 'description' => 'Приз 1 000 000$', 'scheduled_start_time' => $start, 'status' => 1],
                    ['id' => '901', 'name' => 'Скасовано', 'scheduled_start_time' => $start, 'status' => 4],
                ])
                ->push([]),
            'discord.com/api/v10/guilds/222222222222222222/scheduled-events*' => Http::response(['message' => 'Missing Access'], 403),
        ]);

        $this->artisan('events:sync --servers')->assertSuccessful();
        $event = ServerEvent::query()->sole();
        $this->assertSame('discord', $event->source);
        $this->assertSame('https://discord.com/events/111111111111111111/900', $event->url);
        $this->assertSame('111111111111111111', $server->fresh()?->discord_guild_id);

        // Гравець сервера бачить подію в календарі.
        $leader = User::factory()->create();
        app(FamilyService::class)->create($leader, ['server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001']);
        $this->assertSame(1, FamilyMember::query()->where('user_id', $leader->id)->count());
        $this->actingAs($leader)->getJson('/events?kind=server')->assertOk()
            ->assertJsonPath('events.0.title', 'Гонки на Vinewood')
            ->assertJsonPath('events.0.host', 'Discord сервера')
            ->assertJsonPath('events.0.can_delete', false);

        // Подію видалили в Discord — зникає й у нас.
        $this->artisan('events:sync --servers')->assertSuccessful();
        $this->assertSame(0, ServerEvent::query()->count());
    }
}
