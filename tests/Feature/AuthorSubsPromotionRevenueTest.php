<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Post;
use App\Models\User;
use App\Services\Billing\AuthorSubscriptions;
use App\Services\Billing\Wallet;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuthorSubsPromotionRevenueTest extends TestCase
{
    use RefreshDatabase;

    private function author(): array
    {
        $author = User::factory()->create();
        $this->actingAs($author)->putJson('/settings/subscriptions/tiers', ['tiers' => [['name' => 'Фан', 'price' => 10000, 'perks' => 'Закриті записи']]])
            ->assertOk()->assertJsonPath('tiers.0.price', 10000);

        return [$author, (int) DB::table('author_tiers')->where('user_id', $author->id)->value('id')];
    }

    public function test_subscription_charges_fan_pays_author_minus_fee_and_unlocks_posts(): void
    {
        [$author, $tierId] = $this->author();
        $this->actingAs($author)->putJson('/settings/subscriptions/tiers', ['tiers' => [['name' => 'X', 'price' => 500]]])->assertUnprocessable();
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'body' => 'Секрет для своїх', 'subscribers_only' => 1])->assertSessionHasNoErrors();
        $post = Post::query()->latest('id')->firstOrFail();
        $this->assertTrue($post->subscribers_only);

        $fan = User::factory()->create();
        $stranger = User::factory()->create();
        $this->actingAs($fan)->postJson('/author-subscriptions', ['tier_id' => $tierId])->assertUnprocessable();

        app(Wallet::class)->credit($fan, 30000, 'topup', 'Поповнення');
        $this->actingAs($fan)->postJson('/author-subscriptions', ['tier_id' => $tierId])->assertOk()->assertJsonPath('balance', 20000);
        $this->assertSame(9000, (int) $author->fresh()?->balance);

        $this->actingAs($fan)->getJson("/posts/{$post->id}")->assertOk();
        $this->actingAs($fan)->get("/{$author->username}")->assertOk();
        $this->assertSame('Секрет для своїх', app(\App\Services\PostPresenter::class)->one($post->fresh(), $fan->fresh())['body']);
        $locked = app(\App\Services\PostPresenter::class)->one($post->fresh(), $stranger);
        $this->assertTrue($locked['locked']);
        $this->assertSame('', $locked['body']);
    }

    public function test_renewal_from_wallet_and_reminder_when_empty(): void
    {
        [$author, $tierId] = $this->author();
        $rich = User::factory()->create();
        $poor = User::factory()->create();
        foreach ([$rich, $poor] as $fan) {
            app(Wallet::class)->credit($fan, 10000, 'topup', 'Поповнення');
            $this->actingAs($fan)->postJson('/author-subscriptions', ['tier_id' => $tierId])->assertOk();
        }
        app(Wallet::class)->credit($rich, 10000, 'topup', 'Поповнення');
        DB::table('author_subscriptions')->update(['expires_at' => now()->addHours(12)]);

        $this->assertSame(1, app(AuthorSubscriptions::class)->renewDue());
        $this->assertTrue(now()->addDays(29)->lt(DB::table('author_subscriptions')->where('user_id', $rich->id)->value('expires_at')));
        $this->assertSame(1, $poor->notifications()->count());
    }

    public function test_community_promotion_and_explore(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, ['name' => 'Рейдери', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        $community->forceFill(['is_listed' => true])->save();
        $this->actingAs(User::factory()->create())->postJson("/c/{$community->slug}/promote")->assertForbidden();
        $this->actingAs($owner)->postJson("/c/{$community->slug}/promote")->assertUnprocessable();

        app(Wallet::class)->credit($owner, 20000, 'topup', 'Поповнення');
        $this->actingAs($owner)->postJson("/c/{$community->slug}/promote")->assertOk();
        $this->assertTrue((bool) $community->fresh()?->promoted_until?->isFuture());
        $this->actingAs(User::factory()->create())->get('/communities?tab=discover')
            ->assertInertia(fn (Assert $page) => $page->where('promoted.0.id', $community->id));
    }

    public function test_revenue_report_and_bulk_actions(): void
    {
        [$author, $tierId] = $this->author();
        $fan = User::factory()->create();
        app(Wallet::class)->credit($fan, 10000, 'topup', 'Поповнення');
        $this->actingAs($fan)->postJson('/author-subscriptions', ['tier_id' => $tierId])->assertOk();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin/revenue')->assertInertia(fn (Assert $page) => $page
            ->component('admin/revenue')->where('months.11.author_fee', 1000)->where('authors.0.id', $author->id));

        $moderator = User::factory()->create(['role' => 'moderator']);
        $this->actingAs($admin)->post('/admin/users/bulk', ['ids' => [$author->id, $fan->id, $moderator->id, $admin->id], 'action' => 'ban', 'reason' => 'спам'])->assertSessionHasNoErrors();
        $this->assertNotNull($author->fresh()?->banned_at);
        $this->assertNotNull($fan->fresh()?->banned_at);
        $this->assertNull($moderator->fresh()?->banned_at);
        $this->assertNull($admin->fresh()?->banned_at);
        $this->actingAs($admin)->post('/admin/users/bulk', ['ids' => [$author->id], 'action' => 'unban']);
        $this->assertNull($author->fresh()?->banned_at);
    }
}
