<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\PlusPayment;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Billing\Shop;
use App\Services\Billing\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** №215: GameCon+ на 5 акаунтів — власник платить, до 4 друзів отримують GameCon+. */
class PlusHouseholdTest extends TestCase
{
    use RefreshDatabase;

    public function test_household_plan_shares_plus_with_friends(): void
    {
        $owner = User::factory()->create(['username' => 'owner']);
        $friends = User::factory()->count(5)->sequence(fn ($s) => ['username' => 'friend'.$s->index])->create();
        $stranger = User::factory()->create(['username' => 'stranger']);
        foreach ($friends as $friend) {
            Friendship::query()->create(['requester_id' => $owner->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        }

        // Без підписки запрошувати нікого.
        $this->actingAs($owner)->postJson('/plus/household', ['username' => 'friend0'])->assertStatus(422);

        app(Wallet::class)->credit($owner, 1_000_000, 'topup', 'Тест');
        $payment = app(Shop::class)->buy($owner, 'household_month', []);
        $this->assertTrue($owner->fresh()->isPlus());

        $this->actingAs($owner)->postJson('/plus/household', ['username' => 'stranger'])->assertStatus(422);
        foreach (range(0, 3) as $i) {
            $this->actingAs($owner)->postJson('/plus/household', ['username' => 'friend'.$i])->assertOk();
        }
        // П’ятий учасник (шостий акаунт) — не влазить.
        $this->actingAs($owner)->postJson('/plus/household', ['username' => 'friend4'])->assertStatus(422);

        $invite = $this->actingAs($friends[0])->getJson('/plus/household')->assertOk()->json('invites.0.id');
        $this->assertFalse($friends[0]->fresh()->isPlus());
        $this->actingAs($friends[0])->postJson("/plus/household/{$invite}/accept")->assertOk()->assertJsonPath('member_of.owner.id', $owner->id);
        $this->assertTrue($friends[0]->fresh()->isPlus());
        $this->assertFalse($stranger->fresh()->isPlus());

        // Продовження власника тягне й учасника.
        $before = $friends[0]->fresh()->plus_until;
        app(Shop::class)->buy($owner, 'household_month', []);
        $this->assertTrue($friends[0]->fresh()->plus_until->gt($before->copy()->addDays(29)));

        // Відхилити запрошення.
        $other = $this->actingAs($friends[1])->getJson('/plus/household')->json('invites.0.id');
        $this->actingAs($friends[1])->deleteJson("/plus/household/{$other}")->assertOk()->assertJsonPath('invites', []);

        // Повернення всіх оплат — учасник втрачає GameCon+.
        foreach (PlusPayment::query()->where('user_id', $owner->id)->get() as $paid) {
            app(Shop::class)->refund($paid, null);
        }
        $this->assertFalse($owner->fresh()->isPlus());
        $this->assertFalse($friends[0]->fresh()->isPlus());

        // Міст для застосунку.
        $token = app(ApiTokens::class)->issue($friends[2], 'android');
        $this->withToken($token)->getJson('/api/v1/site/plus/household')->assertOk()->assertJsonPath('max', 4);
        $this->assertNotNull($payment->id);
    }
}
