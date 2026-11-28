<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserCosmetic;
use App\Services\Billing\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** №255: магазин оформлення — назавжди за баланс, одразу вдягається, без дублів і без боргу. */
class CosmeticsShopTest extends TestCase
{
    use RefreshDatabase;

    public function test_buy_equip_and_limits(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/shop')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('shop/index')->where('balance', 0)
                ->where('items.0.owned', false));

        // Без грошей — нічого не купується й нічого не списується.
        $this->actingAs($user)->post('/shop/buy', ['key' => 'frame:shop_neon'])->assertSessionHasErrors('item');
        $this->assertSame(0, UserCosmetic::query()->count());

        app(Wallet::class)->credit($user, 10_000, 'topup', 'Тест');
        $this->actingAs($user)->post('/shop/buy', ['key' => 'frame:shop_neon'])->assertSessionHasNoErrors();
        $this->assertSame(10_000 - 7_900, (int) $user->fresh()->balance);
        $this->assertSame('shop_neon', $user->fresh()->cosmetics['frame']);
        $this->assertNotNull($user->fresh()->toCard()['cosmetics']['frame']);

        // Удруге те саме — ні; нагороду сезону купити не можна.
        $this->actingAs($user)->post('/shop/buy', ['key' => 'frame:shop_neon'])->assertSessionHasErrors('item');
        $this->actingAs($user)->post('/shop/buy', ['key' => 'frame:pass_gold'])->assertSessionHasErrors('item');

        // Зняти й вдягнути знову; чуже не вдягнеш.
        $this->actingAs($user)->post('/shop/equip', ['type' => 'frame', 'value' => null])->assertRedirect();
        $this->assertArrayNotHasKey('frame', (array) $user->fresh()->cosmetics);
        $this->actingAs($user)->post('/shop/equip', ['type' => 'frame', 'value' => 'shop_lava'])->assertSessionHasErrors('value');
    }
}
