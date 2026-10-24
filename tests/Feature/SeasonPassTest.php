<?php

namespace Tests\Feature;

use App\Models\QuestClaim;
use App\Models\Season;
use App\Models\SeasonPassClaim;
use App\Models\StickerPack;
use App\Models\User;
use App\Models\UserCosmetic;
use App\Services\Achievements;
use App\Services\Quests\SeasonPass;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SeasonPassTest extends TestCase
{
    use RefreshDatabase;

    private function pass(): SeasonPass
    {
        return app(SeasonPass::class);
    }

    /** Сезон поточного місяця з нагородами на 1–3 рівнях. */
    private function season(): Season
    {
        return Season::query()->create([
            'key' => $this->pass()->currentKey(),
            'title' => 'Неонова ніч',
            'theme' => 'neon',
            'levels' => array_fill(0, 30, 100),
            'rewards' => [
                '1' => ['free' => ['type' => 'frame', 'value' => 'pass_mint'], 'plus' => ['type' => 'badge', 'value' => 'pass_crown']],
                '2' => ['free' => ['type' => 'xp', 'value' => 'xp_100']],
                '3' => ['free' => ['type' => 'name', 'value' => 'pass_sky']],
            ],
        ]);
    }

    private function earn(User $user, int $points): void
    {
        QuestClaim::query()->create(['user_id' => $user->id, 'quest' => 'post', 'day' => now()->toDateString(), 'season' => $this->pass()->currentKey(), 'xp' => $points]);
    }

    public function test_level_is_calculated_from_season_points(): void
    {
        $pass = $this->pass();
        $costs = [50, 100, 150];
        $this->assertSame(['level' => 0, 'into' => 0, 'need' => 50], $pass->levelFor(0, $costs));
        $this->assertSame(['level' => 0, 'into' => 49, 'need' => 50], $pass->levelFor(49, $costs));
        $this->assertSame(['level' => 1, 'into' => 0, 'need' => 100], $pass->levelFor(50, $costs));
        $this->assertSame(['level' => 2, 'into' => 20, 'need' => 150], $pass->levelFor(170, $costs));
        $this->assertSame(['level' => 3, 'into' => 0, 'need' => 0], $pass->levelFor(9999, $costs));

        // Типово — 30 рівнів по points_per_level; адмінські значення мають пріоритет.
        $default = $pass->costs($pass->find('2000-01'));
        $this->assertCount(30, $default);
        $this->assertSame((int) config('season_pass.points_per_level'), $default[0]);
        $this->assertSame(100, $pass->costs($this->season())[29]);
    }

    public function test_free_and_premium_claims(): void
    {
        $this->withoutVite();
        $this->season();
        $user = User::factory()->create();
        $this->earn($user, 150);

        $this->actingAs($user)->get('/season')->assertInertia(fn (Assert $page) => $page->component('season/index')
            ->where('level', 1)->where('points', 150)->where('plus', false)->where('season.title', 'Неонова ніч')
            ->where('levels.0.free.value', 'pass_mint')->where('levels.0.plus.type', 'badge')->has('levels', 30));

        // Рівень 2 ще не досягнуто, на 4-му немає нагороди.
        $this->actingAs($user)->post('/season/levels/2/free/claim')->assertSessionHasErrors('level');
        $this->actingAs($user)->post('/season/levels/4/free/claim')->assertSessionHasErrors('level');

        $this->actingAs($user)->post('/season/levels/1/free/claim')->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('user_cosmetics', ['user_id' => $user->id, 'type' => 'frame', 'value' => 'pass_mint']);

        // Доріжка GameCon+ — лише з підпискою.
        $this->actingAs($user)->post('/season/levels/1/plus/claim')->assertSessionHasErrors('level');
        $this->assertDatabaseMissing('user_cosmetics', ['user_id' => $user->id, 'type' => 'badge']);

        $user->forceFill(['plus_until' => now()->addMonth()])->save();
        $this->actingAs($user)->post('/season/levels/1/plus/claim')->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('user_cosmetics', ['user_id' => $user->id, 'type' => 'badge', 'value' => 'pass_crown']);
    }

    public function test_claims_are_idempotent_and_xp_goes_to_the_profile_level(): void
    {
        $this->season();
        $user = User::factory()->create();
        $this->earn($user, 200);
        $before = app(Achievements::class)->for($user)['xp'];

        $first = $this->pass()->claim($user, 2, 'free');
        $second = $this->pass()->claim($user, 2, 'free');
        $this->assertTrue($first['fresh']);
        $this->assertFalse($second['fresh']);
        $this->assertSame(1, SeasonPassClaim::query()->where('user_id', $user->id)->count());
        $this->assertSame(100, $this->pass()->bonusXp($user));
        $this->assertSame($before + 100, app(Achievements::class)->for($user)['xp']);

        $this->pass()->claim($user, 1, 'free');
        $this->pass()->claim($user, 1, 'free');
        $this->assertSame(1, UserCosmetic::query()->where('user_id', $user->id)->count());

        $this->actingAs($user)->post('/season/levels/1/free/claim')->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame(2, SeasonPassClaim::query()->where('user_id', $user->id)->count());
    }

    public function test_equipping_shows_cosmetics_on_the_user_card(): void
    {
        $this->season();
        $user = User::factory()->create();
        $this->earn($user, 300);
        $this->assertNull($user->toCard()['cosmetics']);

        // Не з інвентаря — не вдягнеш.
        $this->actingAs($user)->post('/season/equip', ['type' => 'frame', 'value' => 'pass_mint'])->assertSessionHasErrors('value');
        $this->actingAs($user)->post('/season/equip', ['type' => 'xp', 'value' => 'xp_100'])->assertSessionHasErrors('type');

        $this->pass()->claim($user, 1, 'free');
        $this->pass()->claim($user, 3, 'free');
        $this->actingAs($user)->post('/season/equip', ['type' => 'frame', 'value' => 'pass_mint'])->assertSessionHasNoErrors();
        $this->actingAs($user)->post('/season/equip', ['type' => 'name', 'value' => 'pass_sky'])->assertSessionHasNoErrors();

        $card = $user->fresh()->toCard()['cosmetics'];
        $this->assertSame(config('season_pass.cosmetics.frame.pass_mint.colors'), $card['frame']);
        $this->assertSame(['#38bdf8'], $card['name']);
        $this->assertNull($card['badge']);
        $this->assertTrue(collect($this->pass()->inventory($user->fresh()))->firstWhere('value', 'pass_mint')['equipped']);

        $this->actingAs($user)->post('/season/equip', ['type' => 'frame', 'value' => null])->assertSessionHasNoErrors();
        $this->assertNull($user->fresh()->toCard()['cosmetics']['frame']);
    }

    public function test_sticker_reward_unlocks_a_plus_pack(): void
    {
        $pack = StickerPack::query()->create(['slug' => 'neon_cats', 'name' => 'Неонові коти', 'is_active' => true, 'is_plus' => true]);
        $season = $this->season();
        $season->update(['rewards' => ['1' => ['free' => ['type' => 'stickers', 'value' => $pack->slug]]]]);
        $user = User::factory()->create();
        $this->earn($user, 100);

        $this->assertSame([], $this->pass()->stickerPacks($user));
        $this->pass()->claim($user, 1, 'free');
        $this->assertSame(['neon_cats'], $this->pass()->stickerPacks($user));
    }

    public function test_only_admins_edit_seasons(): void
    {
        $this->withoutVite();
        $key = $this->pass()->currentKey();
        $payload = [
            'title' => 'Крижаний сезон',
            'theme' => 'frost',
            'levels' => array_fill(0, 30, 60),
            'rewards' => [
                '1' => ['free' => ['type' => 'frame', 'value' => 'pass_ice'], 'plus' => null],
                '5' => ['plus' => ['type' => 'header', 'value' => 'aurora']],
            ],
        ];

        $this->actingAs(User::factory()->create())->get('/admin/seasons')->assertForbidden();
        $this->actingAs(User::factory()->create())->put("/admin/seasons/{$key}", $payload)->assertForbidden();
        $this->assertDatabaseCount('seasons', 0);

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin/seasons')->assertInertia(fn (Assert $page) => $page->component('admin/seasons')
            ->where('current', $key)->has('catalog.frame')->has('edit.track', 30));

        // Нагорода не з каталогу не зберігається.
        $this->actingAs($admin)->put("/admin/seasons/{$key}", [...$payload, 'rewards' => ['1' => ['free' => ['type' => 'frame', 'value' => 'rainbow']]]])
            ->assertSessionHasErrors('rewards.1.free');

        $this->actingAs($admin)->put("/admin/seasons/{$key}", $payload)->assertRedirect()->assertSessionHasNoErrors();
        $season = Season::query()->where('key', $key)->firstOrFail();
        $this->assertSame('Крижаний сезон', $season->title);
        $this->assertSame(['1' => ['free' => ['type' => 'frame', 'value' => 'pass_ice']], '5' => ['plus' => ['type' => 'header', 'value' => 'aurora']]], $season->rewards);
        $this->assertSame(60, $this->pass()->costs($season)[0]);
    }
}
