<?php

namespace Tests\Feature;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PartyPost;
use App\Models\PlusCode;
use App\Models\PlusGrant;
use App\Models\ServerPromotion;
use App\Models\User;
use App\Services\Billing\Wallet;
use App\Services\Families\FamilyService;
use App\Services\Plus\Plus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** GameCon+: промокоди, черга періодів, бонуси, сім’ї й просування, адмінка. Оплата з рахунку — BillingTest. */
class GameconPlusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_promo_code_can_be_redeemed_once_per_person(): void
    {
        [$a, $b, $c] = User::factory()->count(3)->create();
        PlusCode::query()->create(['code' => 'GAMECON-30', 'days' => 30, 'max_uses' => 2]);

        $this->actingAs($a)->post('/plus/redeem', ['code' => 'gamecon-30'])->assertRedirect();
        $this->assertTrue($a->fresh()->isPlus());
        $this->actingAs($a)->post('/plus/redeem', ['code' => 'GAMECON-30'])->assertSessionHasErrors('code');
        $this->actingAs($b)->post('/plus/redeem', ['code' => 'GAMECON-30'])->assertRedirect();
        $this->actingAs($c)->post('/plus/redeem', ['code' => 'GAMECON-30'])->assertSessionHasErrors('code');
    }

    public function test_gifts_and_codes_stack_one_after_another(): void
    {
        $user = User::factory()->create();
        $plus = app(Plus::class);
        $plus->grant($user, 30, 'admin');
        $plus->grant($user, 30, 'code');

        $this->assertSame(now()->addDays(60)->toDateString(), $user->fresh()->plus_until->toDateString());
    }

    public function test_perks_follow_the_subscription(): void
    {
        $user = User::factory()->create();
        for ($i = 0; $i < 3; $i++) {
            PartyPost::query()->create(['user_id' => $user->id, 'title' => 'Паті '.$i, 'slots' => 4, 'expires_at' => now()->addHours(3)]);
        }
        $this->actingAs($user)->post('/party', ['title' => 'Ще одна', 'slots' => 4])->assertStatus(422);
        $this->actingAs($user)->put('/plus/style', ['name' => 'aurora'])->assertForbidden();

        app(Plus::class)->grant($user, 30, 'admin');
        $this->actingAs($user)->post('/party', ['title' => 'Ще одна', 'slots' => 4])->assertRedirect();

        $this->actingAs($user)->put('/plus/style', ['name' => 'aurora', 'frame' => 'season', 'accent' => 'ocean'])->assertRedirect();
        $card = $user->fresh()->toCard()['plus'];
        $this->assertSame(['#4f8bff', '#a855f7'], $card['name']);
        $this->assertCount(2, $card['frame']);

        // Підняти своє паті — раз на добу.
        $party = PartyPost::query()->where('user_id', $user->id)->latest('id')->first();
        $this->actingAs($user)->post("/party/{$party->id}/bump")->assertRedirect();
        $this->assertTrue($party->fresh()->bumped_until->isFuture());
        $this->actingAs($user)->post("/party/{$party->id}/bump")->assertStatus(429);
    }

    public function test_family_plan_and_server_promotion_are_bought_from_the_wallet(): void
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        GtaServer::query()->create([
            'slug' => 'stake', 'name' => 'Stake RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed', 'players_online' => 900,
        ]);
        $leader = User::factory()->create();
        $server->forceFill(['owner_id' => $leader->id])->save();
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $family->forceFill(['status' => Family::STATUS_VERIFIED])->save();
        app(Wallet::class)->credit($leader, 100000, 'topup', 'Тест');

        // GameCon+ отримує сім’я, не лідер; лідер платить і може ввімкнути автопродовження.
        $this->actingAs($leader)->postJson('/plus/billing/purchase', ['product' => 'family_month', 'family_id' => $family->id, 'renew' => true])->assertOk();
        $this->assertTrue($family->fresh()->isPlus());
        $this->assertFalse($leader->fresh()->isPlus());
        $this->assertNotNull($family->fresh()->toCard()['plus']);
        $this->assertDatabaseHas('plus_renewals', ['owner_type' => 'family', 'owner_id' => $family->id, 'user_id' => $leader->id, 'active' => true]);

        // Чужа сім’я — ні.
        $stranger = User::factory()->create();
        app(Wallet::class)->credit($stranger, 100000, 'topup', 'Тест');
        $this->actingAs($stranger)->postJson('/plus/billing/purchase', ['product' => 'family_month', 'family_id' => $family->id])->assertStatus(422);
        $this->actingAs($stranger)->postJson('/plus/billing/purchase', ['product' => 'promo_top_7', 'server_id' => $server->id])->assertStatus(422);

        $this->actingAs($leader)->postJson('/plus/billing/purchase', ['product' => 'promo_top_7', 'server_id' => $server->id])->assertOk();
        $this->assertSame(1, ServerPromotion::query()->live()->count());
        $this->assertSame(100000 - 39900 - 49900, $leader->fresh()->balance);

        // Просуваний сервер — першим, попри менший онлайн.
        $this->actingAs($leader)->get('/servers?lang=all')->assertInertia(fn (Assert $page) => $page
            ->where('servers.0.slug', 'quant')
            ->where('servers.0.promo', ['top'])
            ->where('servers.1.slug', 'stake'));
        $this->actingAs($leader)->get(route('servers.show', $server))
            ->assertInertia(fn (Assert $page) => $page->has('promotion.active', 1));
    }

    public function test_admin_grants_codes_and_sees_payments(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create(['username' => 'taras']);

        $this->actingAs($user)->get('/admin/plus')->assertForbidden();
        $this->actingAs($admin)->post('/admin/plus/grants', ['username' => '@taras', 'days' => 14, 'note' => 'Допомога з перекладом'])->assertRedirect();
        $this->assertTrue($user->fresh()->isPlus());
        $this->actingAs($admin)->post('/admin/plus/codes', ['type' => 'days', 'days' => 7, 'max_uses' => 10])->assertSessionHasNoErrors();
        $this->actingAs($admin)->post('/admin/plus/codes', ['type' => 'discount', 'percent' => 120, 'max_uses' => 10])->assertSessionHasErrors('percent');

        $this->actingAs($admin)->get('/admin/plus')->assertInertia(fn (Assert $page) => $page
            ->component('admin/plus')
            ->where('stats.users', 1)
            ->has('grants', 1)
            ->has('codes', 1));

        $grant = PlusGrant::query()->firstOrFail();
        $this->actingAs($admin)->delete("/admin/plus/grants/{$grant->id}")->assertRedirect();
        $this->assertFalse($user->fresh()->isPlus());
    }
}
