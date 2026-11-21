<?php

namespace Tests\Feature;

use App\Jobs\FetchGameLogo;
use App\Models\Game;
use App\Models\User;
use App\Services\Clans\ClanService;
use App\Services\Games\GameLogoFetcher;
use App\Services\Profile\Affiliations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Значки біля ніка: клан і гільдія з логотипом гри, порядок з налаштувань, логотипи ігор. */
class AffiliationBadgesTest extends TestCase
{
    use RefreshDatabase;

    private function clan(User $owner, Game $game, string $type, string $name, string $tag): void
    {
        app(ClanService::class)->create($owner, ['type' => $type, 'name' => $name, 'tag' => $tag, 'game_id' => $game->id, 'features' => [], 'join_mode' => 'open'], null);
    }

    public function test_clan_and_guild_show_game_badge_and_order_follows_settings(): void
    {
        Queue::fake();
        $cs = Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $wow = Game::query()->create(['slug' => 'wow', 'name' => 'World of Warcraft', 'letter' => 'W', 'category' => 'pc', 'is_published' => true]);
        $user = User::factory()->create();
        $this->clan($user, $cs, 'clan', 'Night Wolves', 'NW');
        $this->clan($user, $wow, 'guild', 'Silver Hand', 'SH');

        $badges = app(Affiliations::class)->forUsers([$user])[$user->id];
        $this->assertSame(['clan', 'game', 'guild', 'game'], array_column($badges, 'kind'));
        $this->assertSame(['CS2', 'World of Warcraft'], array_values(array_column(array_filter($badges, fn ($b) => $b['kind'] === 'game'), 'name')));
        // Логотипа гри ще немає — шукаємо його у фоні, обкладинку не беремо.
        $this->assertNull($badges[1]['logo']);
        Queue::assertPushed(FetchGameLogo::class);

        // Людина ставить гільдію першою.
        $guild = $badges[2]['group'];
        $this->actingAs($user)->putJson('/settings/badges', ['order' => [$guild]])->assertOk()->assertJsonPath('groups.0.key', $guild);
        $badges = app(Affiliations::class)->forUsers([$user->fresh()])[$user->id];
        $this->assertSame('guild', $badges[0]['kind']);
        $this->actingAs($user)->getJson('/settings/badges')->assertOk()->assertJsonCount(2, 'groups');
    }

    public function test_game_logo_comes_from_app_store_icon_not_cover(): void
    {
        Storage::fake('public');
        $png = UploadedFile::fake()->image('icon.png', 512, 512)->getContent();
        Http::fake([
            'itunes.apple.com/*' => Http::response(['results' => [['artworkUrl512' => 'https://is1.mzstatic.com/icon512.png']]]),
            'is1.mzstatic.com/*' => Http::response($png, 200, ['Content-Type' => 'image/png']),
        ]);
        $game = Game::query()->create(['slug' => 'pubg', 'name' => 'PUBG', 'letter' => 'P', 'category' => 'mobile', 'is_published' => true,
            'cover' => 'https://example.com/cover.jpg', 'links' => [['store' => 'appstore', 'url' => 'https://apps.apple.com/app/pubg/id1330123889']]]);

        $this->assertSame('appstore', app(GameLogoFetcher::class)->fetch($game));
        $game->refresh();
        $this->assertNotNull($game->logo_path);
        Storage::disk('public')->assertExists((string) $game->logo_path);
        $this->assertFalse(GameLogoFetcher::due($game));
    }
}
