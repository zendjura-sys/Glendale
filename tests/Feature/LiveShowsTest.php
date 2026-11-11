<?php

namespace Tests\Feature;

use App\Jobs\EndShowQuestion;
use App\Models\LiveShow;
use App\Models\LiveShowMember;
use App\Models\User;
use App\Services\Shows\LiveShows;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Шоу наживо: формати, рука, слово гостю на таймері, місця на сцені, завершення. */
class LiveShowsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake();
        app(SiteSettings::class)->put(['livekit_url' => 'wss://voice.test', 'livekit_api_key' => 'key']);
        config(['services.livekit.secret' => str_repeat('s', 32)]);
    }

    private function live(User $host, array $extra = []): LiveShow
    {
        $this->actingAs($host)->post('/shows', ['title' => 'Розбір патча', 'topic' => '#patch', 'format' => 'duo', ...$extra])->assertRedirect();

        return LiveShow::query()->latest('id')->firstOrFail();
    }

    public function test_formats_set_seats_and_scheduled_shows_wait(): void
    {
        $host = User::factory()->create();
        $duo = $this->live($host);
        $this->assertSame([2, 1, 60, 'live', 'patch'], [$duo->stage_seats, $duo->guest_seats, $duo->question_seconds, $duo->status, $duo->topic]);
        $this->actingAs($host)->post('/shows', ['title' => 'Друге', 'format' => 'duo'])->assertStatus(422);

        $this->actingAs($host)->post('/shows', ['title' => 'Пізніше', 'format' => 'custom', 'stage_seats' => 6, 'guest_seats' => 3, 'question_seconds' => 90, 'scheduled_at' => now()->addDay()->toIso8601String()])->assertRedirect();
        $later = LiveShow::query()->latest('id')->firstOrFail();
        $this->assertSame([6, 3, 90, 'scheduled'], [$later->stage_seats, $later->guest_seats, $later->question_seconds, $later->status]);
        $this->withoutVite()->actingAs($host)->get('/shows')->assertOk();
        $this->actingAs($host)->postJson("/shows/{$later->id}/start")->assertOk()->assertJsonPath('show.status', 'live');
    }

    public function test_guest_gets_floor_for_a_minute_then_mic_is_taken(): void
    {
        Queue::fake();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $other = User::factory()->create();
        $show = $this->live($host);

        $this->actingAs($guest)->postJson("/shows/{$show->id}/join")->assertOk()->assertJsonStructure(['url', 'token', 'identity']);
        $this->actingAs($other)->postJson("/shows/{$show->id}/join")->assertOk();
        $this->actingAs($guest)->postJson("/shows/{$show->id}/hand", ['raised' => true])->assertOk();
        // Руки бачить лише сцена.
        $this->actingAs($other)->getJson("/shows/{$show->id}/state")->assertJsonCount(0, 'hands');
        $this->actingAs($host)->getJson("/shows/{$show->id}/state")->assertJsonPath('hands.0.id', $guest->id);

        $this->actingAs($other)->postJson("/shows/{$show->id}/floor/{$guest->id}")->assertForbidden();
        $this->actingAs($host)->postJson("/shows/{$show->id}/floor/{$guest->id}")->assertOk()->assertJsonPath('guests.0.id', $guest->id);
        Queue::assertPushed(EndShowQuestion::class);
        // Місце для гостя одне — другий чекає.
        $this->actingAs($host)->postJson("/shows/{$show->id}/floor/{$other->id}")->assertStatus(422);

        $this->travel(61)->seconds();
        $this->actingAs($host)->getJson("/shows/{$show->id}/state")->assertJsonCount(0, 'guests');
        $this->assertSame('listener', LiveShowMember::query()->where('user_id', $guest->id)->value('role'));
        $this->actingAs($host)->postJson("/shows/{$show->id}/floor/{$other->id}")->assertOk();
    }

    public function test_question_job_takes_mic_unless_floor_was_given_again(): void
    {
        Queue::fake();
        $host = User::factory()->create();
        $guest = User::factory()->create();
        $show = $this->live($host);
        $this->actingAs($guest)->postJson("/shows/{$show->id}/join");
        $shows = app(LiveShows::class);
        $first = $shows->giveFloor($show, $guest)->mic_until;

        // Ведучий дав слово ще раз пізніше — стара задача нічого не забирає.
        LiveShowMember::query()->where('user_id', $guest->id)->update(['mic_until' => now()->addMinutes(2)]);
        (new EndShowQuestion($show->id, $guest->id, $first->toIso8601String()))->handle($shows);
        $this->assertSame('guest', LiveShowMember::query()->where('user_id', $guest->id)->value('role'));

        (new EndShowQuestion($show->id, $guest->id, now()->addMinutes(2)->toIso8601String()))->handle($shows);
        $this->assertSame('listener', LiveShowMember::query()->where('user_id', $guest->id)->value('role'));
    }

    public function test_stage_seats_limit_and_staff_can_end_show(): void
    {
        $host = User::factory()->create();
        $show = $this->live($host);
        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->actingAs($host)->postJson("/shows/{$show->id}/speakers", ['username' => $a->username])->assertOk()->assertJsonCount(2, 'stage');
        $this->actingAs($host)->postJson("/shows/{$show->id}/speakers", ['username' => $b->username])->assertStatus(422);
        $this->actingAs($a)->postJson("/shows/{$show->id}/end")->assertForbidden();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->postJson("/shows/{$show->id}/end")->assertOk()->assertJsonPath('show.status', 'ended');
        $this->actingAs($b)->postJson("/shows/{$show->id}/join")->assertStatus(422);
    }
}
