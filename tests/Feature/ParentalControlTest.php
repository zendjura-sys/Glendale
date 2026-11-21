<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\ParentalControl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** №227: батьківський контроль — згода, нічна пауза, заявки лише від друзів друзів. */
class ParentalControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_parent_links_teen_and_rules_apply(): void
    {
        $parent = User::factory()->create(['username' => 'mom', 'birthday' => now()->subYears(40)]);
        $teen = User::factory()->create(['username' => 'kid', 'birthday' => now()->subYears(14)]);
        $adult = User::factory()->create(['username' => 'adult', 'birthday' => now()->subYears(30)]);
        $stranger = User::factory()->create(['birthday' => now()->subYears(20)]);

        // Лише для підліткового режиму; підліток не стає «батьками».
        $this->actingAs($parent)->postJson('/settings/parental', ['username' => 'adult'])->assertStatus(422);
        $this->actingAs($teen)->postJson('/settings/parental', ['username' => 'kid'])->assertStatus(422);

        $link = $this->actingAs($parent)->postJson('/settings/parental', ['username' => 'kid'])->assertOk()->json('children.0.id');
        // Правила діють лише після згоди.
        $this->assertNull(app(ParentalControl::class)->rulesFor($teen));
        $this->actingAs($teen)->getJson('/settings/parental')->assertJsonPath('parents.0.status', 'invited');
        $this->actingAs($teen)->postJson("/settings/parental/{$link}/accept")->assertOk()->assertJsonPath('parents.0.status', 'active');

        // Заявки — лише від друзів друзів (типово ввімкнено).
        $this->actingAs($stranger)->post(route('friends.store', $teen))->assertForbidden();
        $this->actingAs($parent)->putJson("/settings/parental/{$link}", ['friends_of_friends' => false])->assertOk();
        $this->actingAs($stranger)->post(route('friends.store', $teen))->assertRedirect();

        // Нічна пауза 23:00–07:00 (Київ): о 23:30 — 423 і на сайті, і в застосунку; налаштування доступні.
        Carbon::setTestNow(Carbon::parse('2026-11-21 23:30', 'Europe/Kyiv'));
        $this->actingAs($teen)->get('/feed')->assertStatus(423);
        $this->actingAs($teen)->getJson('/settings/parental')->assertOk();
        $this->withToken(app(ApiTokens::class)->issue($teen, 'android'))->getJson('/api/v1/site/me/now')->assertStatus(423);
        $this->actingAs($parent)->get('/feed')->assertOk();
        Carbon::setTestNow(Carbon::parse('2026-11-22 08:00', 'Europe/Kyiv'));
        $this->actingAs($teen)->get('/feed')->assertOk();

        // До 18 підліток сам не вимикає; батьки — можуть.
        $this->actingAs($teen)->deleteJson("/settings/parental/{$link}")->assertStatus(422);
        $this->actingAs($parent)->deleteJson("/settings/parental/{$link}")->assertOk()->assertJsonPath('children', []);
        Carbon::setTestNow();
    }
}
