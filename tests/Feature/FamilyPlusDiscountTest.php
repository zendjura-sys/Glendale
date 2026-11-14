<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Billing\Catalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Лідер із власним GameCon+ платить за GameCon+ для сім’ї на 50 % менше. */
class FamilyPlusDiscountTest extends TestCase
{
    use RefreshDatabase;

    public function test_family_plan_is_half_price_for_plus_leader(): void
    {
        $catalog = app(Catalog::class);
        $full = $catalog->price('family_month');
        $plain = User::factory()->create();
        $plus = User::factory()->create(['plus_until' => now()->addMonth()]);

        $this->assertSame($full, $catalog->priceFor($plain, 'family_month'));
        $this->assertSame((int) (round($full / 2 / 100) * 100), $catalog->priceFor($plus, 'family_month'));
        // Власний GameCon+ знижки не має.
        $this->assertSame($catalog->price('plus_month'), $catalog->priceFor($plus, 'plus_month'));
    }

    public function test_pricing_page_explains_discount(): void
    {
        $this->get('/pricing')->assertOk()->assertInertia(fn ($page) => $page
            ->where('family_plus_discount', 50)
            ->has('community_promo.price'));
    }
}
