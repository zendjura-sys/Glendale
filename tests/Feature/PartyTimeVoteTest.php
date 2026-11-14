<?php

namespace Tests\Feature;

use App\Models\PartyPost;
use App\Models\User;
use App\Notifications\PartyTimePicked;
use App\Services\Auth\ApiTokens;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Голосування за час гри в «Пошуку паті»: варіанти, «мені підходить», закріплення, сповіщення. */
class PartyTimeVoteTest extends TestCase
{
    use RefreshDatabase;

    private function party(User $host): PartyPost
    {
        $this->actingAs($host)->post('/party', [
            'title' => 'Рейд у п’ятницю',
            'slots' => 4,
            'time_options' => [now()->addDay()->setTime(21, 0)->toIso8601String(), now()->addDay()->setTime(19, 0)->toIso8601String()],
        ])->assertRedirect();

        return PartyPost::query()->latest('id')->firstOrFail();
    }

    public function test_people_vote_host_picks_and_voters_are_notified(): void
    {
        Notification::fake();
        $host = User::factory()->create();
        $fan = User::factory()->create();
        $other = User::factory()->create();
        $party = $this->party($host);

        $this->assertNull($party->starts_at);
        $this->assertTrue($party->expires_at->greaterThan(now()->addDay()->setTime(21, 0)));
        [$early, $late] = $party->timeSlots->all();
        $this->assertSame(19, $early->starts_at->hour);

        $this->actingAs($fan)->post("/party/{$party->id}/time", ['slots' => [$early->id, $late->id]])->assertRedirect();
        $this->actingAs($other)->post("/party/{$party->id}/time", ['slots' => [$late->id]])->assertRedirect();
        // Передумав — лишив тільки ранній.
        $this->actingAs($fan)->post("/party/{$party->id}/time", ['slots' => [$early->id]])->assertRedirect();

        $this->actingAs($fan)->get("/party/{$party->id}")->assertInertia(fn (Assert $page) => $page
            ->where('party.time_poll.decided', false)
            ->where('party.time_poll.options.0.votes', 1)
            ->where('party.time_poll.options.0.mine', true)
            ->where('party.time_poll.options.1.votes', 1)
            ->where('party.time_poll.options.1.mine', false));

        $this->actingAs($fan)->post("/party/{$party->id}/time/{$late->id}")->assertForbidden();
        $this->actingAs($host)->post("/party/{$party->id}/time/{$late->id}")->assertRedirect();

        $party->refresh();
        $this->assertTrue($party->starts_at->equalTo($late->starts_at));
        $this->assertTrue($party->expires_at->equalTo($late->starts_at->copy()->addHours(3)));
        Notification::assertSentTo([$fan, $other], PartyTimePicked::class);
        Notification::assertNotSentTo($host, PartyTimePicked::class);

        // Після закріплення голосувати вже не можна.
        $this->actingAs($fan)->post("/party/{$party->id}/time", ['slots' => [$late->id]])->assertStatus(422);
        $this->actingAs($fan)->get("/party/{$party->id}")->assertInertia(fn (Assert $page) => $page
            ->where('party.time_poll.decided', true)
            ->where('party.time_poll.options.1.picked', true));
    }

    public function test_validation_bridge_and_plugin_switch(): void
    {
        $host = User::factory()->create();
        $this->actingAs($host)->post('/party', ['title' => 'Один варіант', 'slots' => 3, 'time_options' => [now()->addHour()->toIso8601String()]])
            ->assertSessionHasErrors('time_options');

        $party = $this->party($host);
        $token = app(ApiTokens::class)->issue($host, 'android');
        $slot = $party->timeSlots->first();
        $this->withToken($token)->postJson("/api/v1/site/party/{$party->id}/time", ['slots' => [$slot->id]])->assertSuccessful();
        $this->withToken($token)->getJson("/api/v1/site/party/{$party->id}")->assertOk()->assertJsonPath('party.time_poll.options.0.votes', 1);

        app(Plugins::class)->set('party_time_vote', false);
        $this->actingAs($host)->post("/party/{$party->id}/time", ['slots' => []])->assertNotFound();
        $this->actingAs($host)->get("/party/{$party->id}")->assertInertia(fn (Assert $page) => $page->where('party.time_poll', null));
    }
}
