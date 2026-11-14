<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameEvent;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Досягнення Steam, «Мій сетап», підписка «Мій календар», мемогенератор. */
class SetupAchievementsCalendarTest extends TestCase
{
    use RefreshDatabase;

    public function test_steam_achievements_on_profile_and_game(): void
    {
        app(SiteSettings::class)->putSecret('steam_api_key', str_repeat('A', 32));
        $game = Game::query()->create(['slug' => 'cs2', 'name' => 'Counter-Strike 2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true,
            'links' => [['store' => 'steam', 'url' => 'https://store.steampowered.com/app/730/']]]);
        $user = User::factory()->create(['username' => 'neo', 'steam_id' => '76561198000000001']);
        Http::fake([
            '*/IPlayerService/GetOwnedGames/*' => Http::response(['response' => ['games' => [['appid' => 730, 'name' => 'Counter-Strike 2', 'playtime_forever' => 6000]]]]),
            '*/ISteamUserStats/GetPlayerAchievements/*' => Http::response(['playerstats' => ['gameName' => 'Counter-Strike 2', 'achievements' => [
                ['apiname' => 'WIN', 'achieved' => 1], ['apiname' => 'ACE', 'achieved' => 1], ['apiname' => 'KNIFE', 'achieved' => 0],
            ]]]),
            '*/ISteamUserStats/GetSchemaForGame/*' => Http::response(['game' => ['availableGameStats' => ['achievements' => [
                ['name' => 'WIN', 'displayName' => 'Перша перемога', 'icon' => 'https://cdn/win.jpg'],
                ['name' => 'ACE', 'displayName' => 'Ейс', 'icon' => 'https://cdn/ace.jpg'],
            ]]]]),
            '*/ISteamUserStats/GetGlobalAchievementPercentagesForApp/*' => Http::response(['achievementpercentages' => ['achievements' => [
                ['name' => 'WIN', 'percent' => 80.2], ['name' => 'ACE', 'percent' => 3.4],
            ]]]),
        ]);

        $this->getJson('/u/neo/achievements')->assertUnauthorized();
        $viewer = User::factory()->create();
        $this->actingAs($viewer)->getJson('/u/neo/achievements')->assertOk()
            ->assertJsonPath('games.0.unlocked', 2)->assertJsonPath('games.0.total', 3)
            ->assertJsonPath('games.0.rarest.0.name', 'Ейс')->assertJsonPath('games.0.rarest.0.percent', 3.4);
        $this->actingAs($user)->getJson("/games/{$game->slug}/achievements")->assertOk()->assertJsonPath('data.unlocked', 2);
        $this->actingAs($viewer)->getJson("/games/{$game->slug}/achievements")->assertOk()->assertJsonPath('data', null)->assertJsonPath('linked', false);
        $this->actingAs($viewer)->get('/neo')->assertInertia(fn (Assert $page) => $page->where('steamAchievements', true));
    }

    public function test_my_setup_is_saved_and_shown(): void
    {
        $user = User::factory()->create(['username' => 'neo']);
        $viewer = User::factory()->create();
        $this->actingAs($viewer)->get('/neo')->assertInertia(fn (Assert $page) => $page->where('setup', null));

        $this->actingAs($user)->put('/settings/setup', ['public' => true, 'cpu' => 'Ryzen 7 7800X3D', 'gpu' => 'RTX 4070', 'ram' => 32, 'mouse' => 'Logitech G Pro X', 'headset' => 'HyperX Cloud II'])
            ->assertSessionHasNoErrors();
        $this->actingAs($viewer)->get('/neo')->assertInertia(fn (Assert $page) => $page
            ->where('setup.pc.gpu', 'RTX 4070')->where('setup.gear.mouse', 'Logitech G Pro X')->where('setup.gear.keyboard', null));
        // «Чи потягне мій ПК» бачить той самий ПК.
        $this->assertSame('Ryzen 7 7800X3D', $user->fresh()->pref('pc')['cpu']);

        $this->actingAs($user)->put('/settings/setup', ['public' => false, 'mouse' => 'Zowie'])->assertSessionHasNoErrors();
        $this->actingAs($viewer)->get('/neo')->assertInertia(fn (Assert $page) => $page->where('setup', null));
        $this->actingAs($user)->get('/neo')->assertInertia(fn (Assert $page) => $page->where('setup.gear.mouse', 'Zowie'));
    }

    public function test_calendar_feed_and_meme_maker(): void
    {
        $user = User::factory()->create();
        GameEvent::query()->create(['title' => 'Nova Night', 'type' => 'showcase', 'starts_at' => now()->addDay(), 'source' => 'manual']);

        $url = null;
        $this->actingAs($user)->get('/events')->assertInertia(function (Assert $page) use (&$url) {
            $url = $page->toArray()['props']['feed_url'];
        });
        $this->assertMatchesRegularExpression('#/calendar/[A-Za-z0-9]{40}\.ics$#', (string) $url);
        auth()->logout();

        $path = (string) parse_url((string) $url, PHP_URL_PATH);
        $ics = $this->get($path)->assertOk()->assertHeader('Content-Type', 'text/calendar; charset=utf-8')->getContent();
        $this->assertStringContainsString('X-WR-CALNAME:GameCon — мої події', (string) $ics);
        $this->assertStringContainsString('SUMMARY:Nova Night', (string) $ics);
        $this->get('/calendar/'.str_repeat('x', 40).'.ics')->assertNotFound();

        $this->actingAs($user)->post('/events/feed/reset')->assertRedirect();
        auth()->logout();
        $this->get($path)->assertNotFound();

        $this->actingAs($user)->get('/memes/new')->assertInertia(fn (Assert $page) => $page->component('memes/create'));
    }
}
