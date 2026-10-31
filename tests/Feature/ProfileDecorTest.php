<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\User;
use App\Models\WatchParty;
use App\Models\WatchPartyMember;
use App\Services\Plus\Plus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Оформлення профілю GameCon+ (анімований нік, ефект шапки) і блок «Дивилися й слухали разом». */
class ProfileDecorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_name_animation_and_header_effect_are_paid_style_options(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();
        $this->actingAs($user)->put('/plus/style', ['fx' => 'flow', 'header' => 'rim'])->assertForbidden();

        app(Plus::class)->grant($user, 30, 'admin');
        $this->actingAs($user)->put('/plus/style', ['name' => 'aurora', 'fx' => 'shine', 'header' => 'aurora', 'accent' => 'ocean'])->assertRedirect();
        $this->assertSame('shine', $user->fresh()->toCard()['plus']['fx']);

        $this->actingAs($viewer)->get(route('profile.show', $user))->assertInertia(fn (Assert $page) => $page
            ->where('profile.header_fx', 'aurora')
            ->where('profile.plus.fx', 'shine'));

        // Невідомі значення відкидаються.
        $this->actingAs($user)->put('/plus/style', ['fx' => 'blink', 'header' => 'glow'])->assertRedirect();
        $this->assertArrayNotHasKey('fx', $user->fresh()->plus_style ?? []);
        $this->actingAs($viewer)->get(route('profile.show', $user))->assertInertia(fn (Assert $page) => $page
            ->where('profile.header_fx', null)
            ->where('profile.plus.fx', null));

        // Без GameCon+ ефекти не показуються.
        $user->forceFill(['plus_until' => now()->subDay(), 'plus_style' => ['header' => 'rim', 'fx' => 'flow']])->save();
        $this->actingAs($viewer)->get(route('profile.show', $user))->assertInertia(fn (Assert $page) => $page
            ->where('profile.header_fx', null)
            ->where('profile.plus', null));
    }

    public function test_watched_together_can_hide_people_or_the_whole_block(): void
    {
        $owner = User::factory()->create();
        $mate = User::factory()->create();
        $other = User::factory()->create();
        $viewer = User::factory()->create();
        $movie = Movie::query()->create(['slug' => 'boy-general', 'type' => 'film', 'title' => 'Мальчик-генерал', 'is_published' => true]);
        $party = WatchParty::query()->create(['code' => 'ABC123', 'movie_id' => $movie->id, 'host_id' => $owner->id]);
        foreach ([$owner, $mate, $other] as $u) {
            WatchPartyMember::query()->create(['watch_party_id' => $party->id, 'user_id' => $u->id, 'last_seen_at' => now()]);
        }

        $this->actingAs($viewer)->get(route('profile.show', $owner))->assertInertia(fn (Assert $page) => $page
            ->has('together', 2)
            ->where('together.0.together', 'Мальчик-генерал')
            ->where('together.0.kind', 'cinema'));

        $this->actingAs($owner)->postJson('/me/together', ['hide' => $mate->id])->assertOk()->assertJsonCount(1, 'together');
        $this->actingAs($viewer)->get(route('profile.show', $owner))->assertInertia(fn (Assert $page) => $page
            ->has('together', 1)->where('together.0.id', $other->id));

        // Сховати від інших: власник бачить, гості — ні.
        $this->actingAs($owner)->postJson('/me/together', ['off' => true])->assertOk()->assertJsonPath('off', true);
        $this->actingAs($viewer)->get(route('profile.show', $owner))->assertInertia(fn (Assert $page) => $page->has('together', 0));
        $this->actingAs($owner)->get(route('profile.show', $owner))->assertInertia(fn (Assert $page) => $page
            ->has('together', 1)->where('togetherOff', true));

        $this->actingAs($owner)->postJson('/me/together', ['off' => false, 'reset' => true])->assertOk()->assertJsonCount(2, 'together');
    }
}
