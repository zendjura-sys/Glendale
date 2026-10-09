<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Models\FamilySeason;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PhotoAlbum;
use App\Models\User;
use App\Notifications\ComeBackNudge;
use App\Notifications\EventReminder;
use App\Notifications\FamilyActivity;
use App\Services\EventCalendar;
use App\Services\Families\FamilyEvents;
use App\Services\Families\FamilyRating;
use App\Services\Families\FamilyService;
use App\Services\Games\GameCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EventExtrasTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;

    private Family $family;

    /** @var list<FamilyMember> */
    private array $soldiers = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $this->leader = User::factory()->create();
        $this->family = app(FamilyService::class)->create($this->leader, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        foreach (['Tony_Moretti', 'Luca_Brasi', 'Paulie_Gatto'] as $i => $nick) {
            $this->soldiers[] = $this->family->members()->create([
                'user_id' => User::factory()->create()->id, 'rp_nickname' => $nick, 'static_id' => (string) (20000 + $i),
                'rank' => 1, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now(),
            ]);
        }
    }

    private function event(int $minutes, ?int $capacity = null): FamilyEvent
    {
        return FamilyEvent::query()->create([
            'family_id' => $this->family->id, 'title' => 'Бізвар', 'type' => 'bizwar',
            'starts_at' => now()->addMinutes($minutes), 'status' => FamilyEvent::STATUS_PLANNED,
            'capacity' => $capacity, 'checkin_code' => '4821',
        ]);
    }

    private function userOf(FamilyMember $member): User
    {
        return User::query()->findOrFail($member->user_id);
    }

    public function test_full_event_puts_people_in_a_queue_and_a_freed_seat_goes_to_the_first(): void
    {
        Notification::fake();
        $event = $this->event(120, capacity: 2);
        [$a, $b, $c] = $this->soldiers;
        $base = '/f/'.$this->family->slug.'/events/'.$event->id;

        $this->actingAs($this->userOf($a))->post($base.'/rsvp', ['going' => true])->assertRedirect();
        $this->actingAs($this->userOf($b))->post($base.'/rsvp', ['going' => true])->assertRedirect();
        $this->actingAs($this->userOf($c))->post($base.'/rsvp', ['going' => true])->assertRedirect();
        $status = fn (FamilyMember $m) => FamilyEventAttendance::query()->where('event_id', $event->id)->where('member_id', $m->id)->value('status');
        $this->assertSame(FamilyEventAttendance::STATUS_WAITLIST, $status($c));

        $this->actingAs($this->userOf($a))->post($base.'/rsvp', ['going' => false])->assertRedirect();
        $this->assertSame(FamilyEventAttendance::STATUS_DECLINED, $status($a));
        $this->assertSame(FamilyEventAttendance::STATUS_GOING, $status($c));
        Notification::assertSentTo($this->userOf($c), FamilyActivity::class);

        $this->actingAs($this->userOf($c))->get('/f/'.$this->family->slug.'/events')
            ->assertInertia(fn (Assert $page) => $page
                ->where('events.0.capacity', 2)
                ->where('events.0.seats', 2)
                ->where('events.0.my_status', 'going')
                ->where('events.0.checkin_code', null));
    }

    public function test_check_in_code_marks_presence_only_near_the_start(): void
    {
        $early = $this->event(180);
        $soon = $this->event(10);
        $soldier = $this->userOf($this->soldiers[0]);
        $url = fn (FamilyEvent $e) => '/f/'.$this->family->slug.'/events/'.$e->id.'/checkin';

        $this->actingAs($soldier)->post($url($early), ['code' => '4821'])->assertSessionHasErrors('code');
        $this->actingAs($soldier)->post($url($soon), ['code' => '0000'])->assertSessionHasErrors('code');
        $this->actingAs($soldier)->post($url($soon), ['code' => '4821'])->assertSessionHasNoErrors();
        $this->assertSame(FamilyEventAttendance::STATUS_ATTENDED, FamilyEventAttendance::query()->where('event_id', $soon->id)->value('status'));

        // Код бачить лише організатор.
        $this->actingAs($this->leader)->get('/f/'.$this->family->slug.'/events')
            ->assertInertia(fn (Assert $page) => $page->where('events.0.checkin_code', '4821'));
    }

    public function test_finished_event_gets_a_shared_album_for_those_present(): void
    {
        $event = $this->event(-60);
        $present = $this->soldiers[0];
        app(FamilyEvents::class)->close($this->family, $event, $this->family->members()->where('user_id', $this->leader->id)->firstOrFail(), [$present->id]);

        $this->actingAs($this->userOf($this->soldiers[1]))->post('/f/'.$this->family->slug.'/events/'.$event->id.'/album')->assertForbidden();
        $this->actingAs($this->userOf($present))->post('/f/'.$this->family->slug.'/events/'.$event->id.'/album')->assertRedirect();
        $album = PhotoAlbum::query()->sole();
        $this->assertSame($album->id, $event->fresh()?->album_id);
        $this->actingAs($this->leader)->post('/f/'.$this->family->slug.'/events/'.$event->id.'/album')->assertRedirect('/albums/'.$album->id);
        $this->assertSame(1, PhotoAlbum::query()->count());
    }

    public function test_cover_is_stored_with_a_new_event(): void
    {
        Storage::fake('public');
        $this->actingAs($this->leader)->post('/f/'.$this->family->slug.'/events', [
            'title' => 'Збори', 'type' => 'meeting', 'starts_at' => now('Europe/Kyiv')->addDay()->format('Y-m-d\TH:i'),
            'capacity' => 10, 'cover' => UploadedFile::fake()->image('cover.jpg', 1200, 400),
        ])->assertSessionHasNoErrors();
        $event = FamilyEvent::query()->sole();
        $this->assertSame(10, $event->capacity);
        $this->assertNotNull($event->cover_path);
        Storage::disk('public')->assertExists((string) $event->cover_path);
    }

    public function test_leader_ends_a_season_and_the_season_board_starts_from_zero(): void
    {
        $soldier = $this->soldiers[0];
        FamilyReport::query()->forceCreate([
            'family_id' => $this->family->id, 'submitter_id' => $soldier->id, 'beneficiary_id' => $soldier->id,
            'type' => FamilyReport::TYPE_BIZWAR, 'status' => FamilyReport::STATUS_APPROVED, 'event_date' => now()->toDateString(),
            'data' => ['wins' => 2, 'losses' => 0], 'reward' => 0,
        ]);
        $this->actingAs($this->userOf($soldier))->post('/f/'.$this->family->slug.'/rating/season')->assertForbidden();

        $this->actingAs($this->leader)->post('/f/'.$this->family->slug.'/rating/season')->assertRedirect();
        $season = FamilySeason::query()->sole();
        $this->assertSame(1, $season->number);
        $this->assertSame('Tony_Moretti [20000]', $season->top[0]['name'] ?? null);
        $this->assertNotNull($this->family->fresh()?->season_started_at);
        $this->assertSame(0, collect(app(FamilyRating::class)->leaderboard($this->family->fresh() ?? $this->family, 'season'))->sum('points'));

        $this->actingAs($this->leader)->get('/f/'.$this->family->slug.'/rating?period=season')
            ->assertInertia(fn (Assert $page) => $page->where('season.number', 2)->has('seasons', 1));
    }

    public function test_reminder_comes_at_the_time_each_person_chose(): void
    {
        Notification::fake();
        $event = $this->event(300);
        $early = $this->userOf($this->soldiers[0]);
        $this->actingAs($early)->put('/events/reminder', ['lead' => 1440])->assertRedirect();
        $this->assertSame(1440, EventCalendar::leadOf($early->fresh() ?? $early));

        $this->assertSame(1, app(EventCalendar::class)->remind());
        Notification::assertSentTo($early, EventReminder::class);
        Notification::assertNotSentTo($this->leader, EventReminder::class);
        $this->assertSame(0, app(EventCalendar::class)->remind());

        $this->travelTo($event->starts_at->copy()->subMinutes(20));
        $this->assertSame(1, app(EventCalendar::class)->remind());
        Notification::assertSentTo($this->leader, EventReminder::class);
        Notification::assertSentToTimes($early, EventReminder::class, 1);
    }

    public function test_calendar_file_is_given_only_to_those_who_see_the_event(): void
    {
        $event = $this->event(120);
        $response = $this->actingAs($this->leader)->get('/events/family/'.$event->id.'.ics')->assertOk();
        $this->assertStringStartsWith('text/calendar', (string) $response->headers->get('Content-Type'));
        $body = (string) $response->getContent();
        $this->assertStringContainsString('BEGIN:VEVENT', $body);
        $this->assertStringContainsString('SUMMARY:[SCL] Бізвар', $body);
        $this->assertStringContainsString('DTSTART:'.$event->starts_at->copy()->utc()->format('Ymd\THis\Z'), $body);

        $this->actingAs(User::factory()->create())->get('/events/family/'.$event->id.'.ics')->assertNotFound();
    }

    public function test_leaders_nudge_members_who_have_been_away_and_hand_over_leadership(): void
    {
        Notification::fake();
        $away = $this->soldiers[0];
        $this->userOf($away)->forceFill(['last_seen_at' => now()->subDays(20)])->save();
        $here = $this->soldiers[1];
        $this->userOf($here)->forceFill(['last_seen_at' => now()->subHour()])->save();
        $base = '/f/'.$this->family->slug.'/members/';

        $this->actingAs($this->userOf($here))->post($base.$away->id.'/nudge')->assertForbidden();
        $this->actingAs($this->leader)->post($base.$away->id.'/nudge')->assertSessionHasNoErrors();
        Notification::assertSentTo($this->userOf($away), ComeBackNudge::class);
        $this->actingAs($this->leader)->post($base.$away->id.'/nudge')->assertSessionHasErrors('member');
        $this->actingAs($this->leader)->post($base.$here->id.'/nudge')->assertSessionHasErrors('member');

        // Передача лідерства в сім’ї.
        $this->actingAs($this->leader)->post($base.$here->id.'/transfer')->assertRedirect();
        $this->assertSame($here->user_id, $this->family->fresh()?->owner_id);

        // І в клані: новий власник отримує найвищий ранг.
        app(GameCatalog::class)->seed();
        $owner = User::factory()->create();
        $heir = User::factory()->create();
        $clan = Clan::query()->create(['game_id' => Game::query()->where('slug', 'counter-strike-2')->value('id'), 'slug' => 'navi', 'type' => 'clan', 'name' => 'NaVi', 'tag' => 'NAVI', 'owner_id' => $owner->id, 'features' => ['events'], 'join_mode' => 'open']);
        ClanMember::query()->create(['clan_id' => $clan->id, 'user_id' => $owner->id, 'rank' => Clan::LEADER_RANK, 'status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now()]);
        $heirMember = ClanMember::query()->create(['clan_id' => $clan->id, 'user_id' => $heir->id, 'rank' => 1, 'status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now()]);
        $this->actingAs($owner)->post('/clans/navi/members/'.$heirMember->id, ['action' => 'transfer'])->assertRedirect();
        $this->assertSame($heir->id, $clan->fresh()?->owner_id);

        $event = ClanEvent::query()->create(['clan_id' => $clan->id, 'title' => 'Рейд', 'starts_at' => now()->addHour()]);
        $this->actingAs($heir)->get('/events/clan/'.$event->id.'.ics')->assertOk();
    }
}
