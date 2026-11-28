<?php

namespace Tests\Feature;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\GameNews;
use App\Models\PartyPost;
use App\Models\User;
use App\Models\VoiceRoom;
use App\Notifications\GamePatchReleased;
use App\Notifications\PartyAssembled;
use App\Services\Games\SteamNews;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Новини й патчі зі Steam на сторінці гри + сповіщення; голосова для зібраної паті. */
class PatchNewsAndPartyVoiceTest extends TestCase
{
    use RefreshDatabase;

    private function game(): Game
    {
        return Game::query()->create([
            'slug' => 'cs2', 'name' => 'Counter-Strike 2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true,
            'links' => [['store' => 'steam', 'url' => 'https://store.steampowered.com/app/730/']],
        ]);
    }

    /** @var list<array<string, mixed>> */
    private array $items = [];

    /** @param  list<array<string, mixed>>  $items */
    private function steam(array $items): void
    {
        $this->items = $items;
        Http::fake(['api.steampowered.com/*' => fn () => Http::response(['appnews' => ['appid' => 730, 'newsitems' => $this->items]])]);
    }

    private function item(string $gid, string $title, int $daysAgo = 0, array $tags = []): array
    {
        return [
            'gid' => $gid, 'title' => $title, 'url' => "https://steamstore-a.akamaihd.net/news/{$gid}",
            'contents' => '[p]Виправлено [b]баги[/b] на Mirage.[/p] {STEAM_CLAN_IMAGE}/1/x.png <br> Більше FPS.',
            'date' => now()->subDays($daysAgo)->getTimestamp(), 'tags' => $tags,
        ];
    }

    public function test_game_page_loads_news_and_marks_patches(): void
    {
        $game = $this->game();
        $this->steam([$this->item('1', 'Release Notes for 10/27/2026', 0, ['patchnotes']), $this->item('2', 'Major tournament this weekend', 2)]);

        $this->getJson('/games/cs2/news')->assertOk()
            ->assertJsonPath('items.0.title', 'Release Notes for 10/27/2026')
            ->assertJsonPath('items.0.patch', true)
            ->assertJsonPath('items.0.excerpt', 'Виправлено баги на Mirage. Більше FPS.')
            ->assertJsonPath('items.1.patch', false);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'appid=730') && str_contains($request->url(), 'steam_community_announcements'));

        // Повторний запит у межах 3 годин — без звернення до Steam.
        $this->getJson('/games/cs2/news')->assertOk()->assertJsonCount(2, 'items');
        Http::assertSentCount(1);
        $this->assertNotNull($game->fresh()->news_checked_at);
    }

    public function test_new_patch_notifies_players_and_followers_once(): void
    {
        Notification::fake();
        $game = $this->game();
        $player = User::factory()->create();
        $fan = User::factory()->create();
        $quitter = User::factory()->create();
        GameBacklog::query()->create(['user_id' => $player->id, 'game_id' => $game->id, 'status' => GameBacklog::PLAYING]);
        GameBacklog::query()->create(['user_id' => $quitter->id, 'game_id' => $game->id, 'status' => GameBacklog::DROPPED]);
        Follow::query()->create(['user_id' => $fan->id, 'kind' => Follow::GAME, 'subject_id' => $game->id]);

        // Перша перевірка: старі новини — без сповіщень.
        $this->steam([$this->item('1', 'Patch 1.0', 1, ['patchnotes'])]);
        $this->artisan('games:steam-news')->assertSuccessful();
        Notification::assertNothingSent();

        $this->travel(4)->hours();
        $this->steam([$this->item('2', 'Hotfix for Mirage', 0), $this->item('1', 'Patch 1.0', 1, ['patchnotes'])]);
        $this->artisan('games:steam-news')->assertSuccessful();
        Notification::assertSentTo([$player, $fan], GamePatchReleased::class, fn ($n) => $n->news->gid === '2');
        Notification::assertNotSentTo($quitter, GamePatchReleased::class);
        $this->assertSame(2, GameNews::query()->count());

        $this->travel(4)->hours();
        $this->artisan('games:steam-news')->assertSuccessful();
        Notification::assertSentToTimes($player, GamePatchReleased::class, 1);
    }

    public function test_patch_detection(): void
    {
        $this->assertTrue(SteamNews::isPatch(['title' => 'Counter-Strike 2 Update', 'tags' => []]));
        $this->assertTrue(SteamNews::isPatch(['title' => 'Що нового', 'tags' => ['patchnotes']]));
        $this->assertFalse(SteamNews::isPatch(['title' => 'Major: Copenhagen', 'tags' => []]));
    }

    public function test_full_party_gets_voice_room_and_everyone_is_called(): void
    {
        Notification::fake();
        $host = User::factory()->create();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->actingAs($host)->post('/party', ['title' => 'Рейд', 'slots' => 3])->assertRedirect();
        $party = PartyPost::query()->latest('id')->firstOrFail();

        $this->actingAs($a)->post("/party/{$party->id}/join")->assertRedirect();
        Notification::assertNotSentTo($host, PartyAssembled::class);
        $this->actingAs($a)->get("/party/{$party->id}")->assertInertia(fn (Assert $page) => $page
            ->where('party.full', false)->where('party.voice_room', null));

        $this->actingAs($b)->post("/party/{$party->id}/join")->assertRedirect();
        $room = VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_PARTY)->where('owner_id', $party->id)->firstOrFail();
        Notification::assertSentTo([$host, $a, $b], PartyAssembled::class, fn ($n) => $n->roomId === $room->id
            && $n->toArray($host)['url'] === "/party/{$party->id}?voice={$room->id}");

        $this->actingAs($b)->get("/party/{$party->id}")->assertInertia(fn (Assert $page) => $page
            ->where('party.full', true)->where('party.voice_room.id', $room->id));
        $outsider = User::factory()->create();
        $this->actingAs($outsider)->get("/party/{$party->id}")->assertInertia(fn (Assert $page) => $page->where('party.voice_room', null));

        // Хтось вийшов і повернувся — повторно не кличемо.
        $this->actingAs($b)->delete("/party/{$party->id}/join")->assertRedirect();
        $this->actingAs($b)->post("/party/{$party->id}/join")->assertRedirect();
        Notification::assertSentToTimes($host, PartyAssembled::class, 1);
    }
}
