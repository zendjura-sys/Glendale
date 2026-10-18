<?php

namespace Tests\Feature;

use App\Models\PartyMember;
use App\Models\PartyPost;
use App\Models\User;
use App\Notifications\PartyJoined;
use App\Services\Auth\ApiTokens;
use App\Services\Voice\VoiceRooms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PartyBoardTest extends TestCase
{
    use RefreshDatabase;

    public function test_host_posts_players_join_by_role_and_get_the_voice_room(): void
    {
        Notification::fake();
        $this->withoutVite();
        [$host, $medic, $late, $stranger] = User::factory()->count(4)->create();

        $this->actingAs($host)->post(route('party.store'), [
            'title' => 'Рейд на склад',
            'platform' => 'pc',
            'roles' => ['Медик', 'Снайпер', 'Медик'],
            'slots' => 2,
        ])->assertRedirect();
        $party = PartyPost::query()->sole();
        $this->assertSame(['Медик', 'Снайпер'], $party->roles);
        $this->assertTrue($party->expires_at->between(now()->addHours(2), now()->addHours(4)));

        $this->actingAs($medic)->post(route('party.join', $party), ['role' => 'Танк'])->assertStatus(422);
        $this->actingAs($medic)->post(route('party.join', $party), ['role' => 'Медик'])->assertRedirect();
        Notification::assertSentTo($host, PartyJoined::class);
        // Два місця: автор і медик — більше нікого.
        $this->actingAs($late)->post(route('party.join', $party), ['role' => 'Снайпер'])->assertStatus(422);

        $voice = app(VoiceRooms::class);
        $party->load('members');
        $this->assertTrue($voice->canJoin($medic, $party));
        $this->assertFalse($voice->canJoin($stranger, $party));
        $this->actingAs($medic)->getJson('/voice/party/'.$party->id)->assertOk()->assertJsonPath('owner.type', 'party');
        $this->actingAs($stranger)->getJson('/voice/party/'.$party->id)->assertForbidden();

        $this->actingAs($stranger)->get(route('party.index', ['platform' => 'pc']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('party/index')
                ->has('parties', 1)
                ->where('parties.0.count', 2)
                ->where('parties.0.taken_roles', ['Медик']));

        $this->actingAs($medic)->delete(route('party.leave', $party))->assertRedirect();
        $this->assertSame(0, PartyMember::query()->count());

        $this->actingAs($stranger)->delete(route('party.close', $party))->assertForbidden();
        $this->actingAs($host)->delete(route('party.close', $party))->assertRedirect('/party');
        $this->actingAs($stranger)->get(route('party.index'))->assertInertia(fn (Assert $page) => $page->has('parties', 0));
        $this->actingAs($late)->post(route('party.join', $party))->assertStatus(422);
    }

    public function test_open_post_limit_and_app_bridge(): void
    {
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user, 'android');
        for ($i = 0; $i < 3; $i++) {
            $this->withToken($token)->postJson('/api/v1/site/party', ['title' => "Пата {$i}", 'slots' => 4, 'starts_at' => now()->addHour()->toIso8601String()])->assertSuccessful();
        }
        $this->withToken($token)->postJson('/api/v1/site/party', ['title' => 'Зайва', 'slots' => 4])->assertStatus(422);
        $this->withToken($token)->getJson('/api/v1/site/party')->assertOk()->assertJsonCount(3, 'parties');
    }
}
