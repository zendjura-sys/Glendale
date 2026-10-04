<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\User;
use App\Notifications\EventReminder;
use App\Services\EventCalendar;
use App\Services\Families\FamilyEvents;
use App\Services\Families\FamilyService;
use App\Services\Games\GameCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EventCalendarTest extends TestCase
{
    use RefreshDatabase;

    private GtaServer $server;

    private User $leader;

    private User $soldier;

    private Family $family;

    private FamilyMember $soldierMember;

    protected function setUp(): void
    {
        parent::setUp();
        $this->server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $this->leader = User::factory()->create();
        $this->family = app(FamilyService::class)->create($this->leader, [
            'server_id' => $this->server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $this->soldier = User::factory()->create();
        $this->soldierMember = $this->family->members()->create([
            'user_id' => $this->soldier->id, 'rp_nickname' => 'Tony_Moretti', 'static_id' => '20002',
            'rank' => 1, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now(),
        ]);
    }

    private function familyEvent(string $title, int $minutes): FamilyEvent
    {
        return FamilyEvent::query()->create([
            'family_id' => $this->family->id, 'title' => $title, 'type' => 'meeting',
            'starts_at' => now()->addMinutes($minutes), 'status' => FamilyEvent::STATUS_PLANNED,
        ]);
    }

    public function test_calendar_collects_family_clan_and_server_events_with_my_answer(): void
    {
        $meeting = $this->familyEvent('Збори', 120);
        app(FamilyEvents::class)->rsvp($this->family, $meeting, $this->soldierMember, false);

        app(GameCatalog::class)->seed();
        $clan = Clan::query()->create(['game_id' => Game::query()->where('slug', 'counter-strike-2')->value('id'), 'slug' => 'navi', 'type' => 'clan', 'name' => 'NaVi', 'tag' => 'NAVI', 'owner_id' => $this->soldier->id, 'features' => ['events'], 'join_mode' => 'open']);
        ClanMember::query()->create(['clan_id' => $clan->id, 'user_id' => $this->soldier->id, 'rank' => 5, 'status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now()]);
        ClanEvent::query()->create(['clan_id' => $clan->id, 'title' => 'Рейд', 'starts_at' => now()->addHours(5)]);

        // Лідер сім’ї сервера створює подію сервера; рядовий — ні.
        $this->actingAs($this->soldier)->post(route('events.server.store', $this->server), [
            'title' => 'Турнір', 'type' => 'tournament', 'starts_at' => now()->addDay()->setTimezone('Europe/Kyiv')->format('Y-m-d\TH:i'), 'family_id' => $this->family->id,
        ])->assertForbidden();
        $this->actingAs($this->leader)->post(route('events.server.store', $this->server), [
            'title' => 'Турнір', 'type' => 'tournament', 'starts_at' => now()->addDay()->setTimezone('Europe/Kyiv')->format('Y-m-d\TH:i'), 'family_id' => $this->family->id,
        ])->assertSessionHasNoErrors();
        $tournament = ServerEvent::query()->sole();
        $this->assertSame(now()->addDay()->format('Y-m-d H'), $tournament->starts_at->format('Y-m-d H'));

        $this->actingAs($this->soldier)->post(route('events.server.rsvp', $tournament), ['going' => true])->assertSessionHasNoErrors();

        $this->actingAs($this->soldier)->get(route('events.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('events/index')
                ->has('events', 3)
                ->where('events.0.kind', 'family')
                ->where('events.0.status', 'declined')
                ->where('events.0.going_count', 0)
                ->where('events.1.kind', 'clan')
                ->where('events.1.can_decline', false)
                ->where('events.2.kind', 'server')
                ->where('events.2.status', 'going')
                ->where('events.2.going_count', 2)
                ->where('events.2.host', '[SCL] Scaletta Family'));

        $this->actingAs($this->soldier)->get(route('events.index', ['kind' => 'server']))
            ->assertInertia(fn (Assert $page) => $page->has('events', 1));

        $this->actingAs($this->soldier)->get(route('servers.show', $this->server))
            ->assertInertia(fn (Assert $page) => $page->has('events', 1)->has('event_hosts', 0));

        $this->actingAs($this->soldier)->delete(route('events.server.destroy', $tournament))->assertForbidden();
        $this->actingAs($this->leader)->delete(route('events.server.destroy', $tournament))->assertSessionHasNoErrors();
        $this->assertSame(0, ServerEvent::query()->count());
    }

    public function test_reminder_goes_once_to_those_who_did_not_decline(): void
    {
        Notification::fake();
        $soon = $this->familyEvent('Бізвар', 20);
        $this->familyEvent('Пізніше', 300);
        app(FamilyEvents::class)->rsvp($this->family, $soon, $this->soldierMember, false);

        $this->assertSame(1, app(EventCalendar::class)->remind());
        $this->assertSame(0, app(EventCalendar::class)->remind());

        Notification::assertSentTo($this->leader, EventReminder::class, fn (EventReminder $n) => str_contains($n->text, 'Бізвар'));
        Notification::assertNotSentTo($this->soldier, EventReminder::class);
        $this->assertNotNull($soon->fresh()?->reminded_at);
    }
}
