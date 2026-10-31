<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\CrosspostTarget;
use App\Models\User;
use App\Models\VoiceParticipant;
use App\Models\VoiceRoom;
use App\Services\CommunityService;
use App\Services\Profile\StreamSchedule;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StageCrosspostScheduleFormsTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK = 'https://discord.com/api/webhooks/123456789012/abcdefghijklmnopqrstuvwxyz_ABCDEF';

    private function community(User $owner, string $privacy = Community::PRIVACY_OPEN): Community
    {
        return app(CommunityService::class)->create($owner, [
            'name' => 'Кіберспорт UA',
            'type' => Community::TYPE_GROUP,
            'privacy' => $privacy,
            'wall' => Community::WALL_OPEN,
            'category' => 'esports',
        ]);
    }

    public function test_stage_listener_raises_hand_and_becomes_speaker(): void
    {
        $settings = app(SiteSettings::class);
        $settings->put(['livekit_url' => 'wss://voice.gamecon.test', 'livekit_api_key' => 'APIgamecon']);
        $settings->putSecret('livekit_api_secret', 'test-livekit-secret-0123456789');
        Http::fake(['voice.gamecon.test/twirp/*' => Http::response([], 200)]);

        $owner = User::factory()->create();
        $community = $this->community($owner);
        $listener = User::factory()->create();
        app(CommunityService::class)->join($community, $listener);
        $room = VoiceRoom::query()->create(['owner_type' => 'community', 'owner_id' => $community->id, 'name' => 'Подкаст']);

        $this->actingAs($listener)->patchJson(route('voice.update', $room), ['stage' => true])->assertForbidden();
        $this->actingAs($owner)->patchJson(route('voice.update', $room), ['stage' => true])->assertOk();
        $this->assertTrue($room->fresh()->is_stage);

        // Слухач заходить без права говорити.
        $token = $this->actingAs($listener)->postJson(route('voice.join', $room))->assertOk()->json('token');
        $claims = json_decode((string) base64_decode(strtr(explode('.', $token)[1], '-_', '+/')), true);
        $this->assertFalse($claims['video']['canPublish']);

        VoiceParticipant::query()->updateOrCreate(['voice_room_id' => $room->id, 'user_id' => $listener->id], ['joined_at' => now()]);
        $this->actingAs($listener)->postJson(route('voice.hand', $room), ['raised' => true])->assertOk();
        $this->assertNotNull(VoiceParticipant::query()->where('user_id', $listener->id)->value('hand_raised_at'));

        $this->actingAs($owner)->postJson(route('voice.moderate', [$room, $listener->id]), ['action' => 'speaker'])->assertOk();
        $row = VoiceParticipant::query()->where('user_id', $listener->id)->first();
        $this->assertTrue($row->speaker);
        $this->assertNull($row->hand_raised_at);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/UpdateParticipant') && $request['permission']['canPublish'] === true);
    }

    public function test_own_public_post_goes_to_discord_webhook(): void
    {
        Http::fake(['discord.com/*' => Http::response(null, 204)]);
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($other)->postJson("/crosspost/user/{$user->id}", ['platform' => 'discord', 'target' => self::WEBHOOK, 'events' => ['posts']])->assertForbidden();
        $this->actingAs($user)->postJson("/crosspost/user/{$user->id}", ['platform' => 'discord', 'target' => 'https://evil.test/hook', 'events' => ['posts']])->assertStatus(422);
        $this->actingAs($user)->postJson("/crosspost/user/{$user->id}", ['platform' => 'discord', 'target' => self::WEBHOOK, 'events' => ['posts']])
            ->assertCreated()
            ->assertJsonCount(1, 'targets')
            ->assertJsonMissing(['target' => self::WEBHOOK]);

        // Адреса вебхука в базі зашифрована.
        $this->assertStringNotContainsString('webhooks', (string) CrosspostTarget::query()->toBase()->value('target'));

        $this->actingAs($user)->post('/posts', ['body' => 'Сьогодні стрім о 20:00', 'visibility' => 'public'])->assertSessionHasNoErrors();
        Http::assertSent(fn ($request) => $request->url() === self::WEBHOOK && str_contains((string) $request['embeds'][0]['description'], 'Сьогодні стрім'));

        // Приватний запис — нікуди.
        $this->actingAs($user)->post('/posts', ['body' => 'Тільки для друзів', 'visibility' => 'friends'])->assertSessionHasNoErrors();
        $this->assertFalse(collect(Http::recorded())->contains(fn ($pair) => str_contains((string) json_encode($pair[0]->data(), JSON_UNESCAPED_UNICODE), 'Тільки для друзів')));
    }

    public function test_stream_schedule_shows_next_slot_on_profile(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-28 12:00', StreamSchedule::TZ)); // середа
        $user = User::factory()->create(['username' => 'kyiv_live']);

        $this->actingAs($user)->put('/settings/stream-schedule', ['slots' => [
            ['day' => 5, 'time' => '20:00', 'title' => 'CS2 з глядачами'],
            ['day' => 3, 'time' => '18:30', 'title' => null],
        ]])->assertSessionHasNoErrors();
        $this->actingAs($user)->put('/settings/stream-schedule', ['slots' => [['day' => 9, 'time' => '25:00']]])->assertSessionHasErrors();

        $this->actingAs(User::factory()->create())->get('/kyiv_live')->assertInertia(fn (Assert $page) => $page
            ->where('streamSchedule.0.day', 3)
            ->where('streamSchedule.0.next_at', Carbon::parse('2026-10-28 18:30', StreamSchedule::TZ)->utc()->toIso8601String())
            ->where('streamSchedule.1.title', 'CS2 з глядачами'));
        Carbon::setTestNow();
    }

    public function test_closed_community_asks_join_questions(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner, Community::PRIVACY_CLOSED);
        $this->actingAs($owner)->patch("/c/{$community->slug}/settings/rules", [
            'slow_mode' => 0, 'premoderation' => false, 'join_questions' => "Скільки вам років?\nУ що граєте?",
        ])->assertSessionHasNoErrors();
        $this->assertSame(['Скільки вам років?', 'У що граєте?'], $community->fresh()->join_questions);

        $applicant = User::factory()->create();
        $this->actingAs($applicant)->post("/c/{$community->slug}/join", ['answers' => ['19', '']])->assertSessionHasErrors('answers');
        $this->assertNull($community->membershipFor($applicant));

        $this->actingAs($applicant)->post("/c/{$community->slug}/join", ['answers' => ['19', 'CS2 і Dota']])->assertSessionHasNoErrors();
        $membership = $community->membershipFor($applicant);
        $this->assertSame(CommunityMember::STATUS_PENDING, $membership->status);

        $this->actingAs($owner)->get("/c/{$community->slug}/members?tab=requests")->assertInertia(fn (Assert $page) => $page
            ->where('members.data.0.answers.1.q', 'У що граєте?')
            ->where('members.data.0.answers.1.a', 'CS2 і Dota'));
    }
}
