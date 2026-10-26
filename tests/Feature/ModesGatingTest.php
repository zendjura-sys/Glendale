<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Services\Achievements;
use App\Services\MorningDigest;
use App\Services\PostCards;
use App\Support\NotifyPrefs;
use App\Support\ProfileBlocks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Режими: розділів, яких немає в режимі людини, не видно ніде — ні сторінок, ні функцій, ні згадок. */
class ModesGatingTest extends TestCase
{
    use RefreshDatabase;

    private function classic(): User
    {
        $user = User::factory()->create();
        $user->mergePref(['network_mode' => 'classic']);
        $user->save();

        return $user->refresh();
    }

    public function test_classic_mode_hides_gaming_sections_and_their_plugins(): void
    {
        $user = $this->classic();

        $this->actingAs($user)->get('/games')->assertNotFound();
        $this->actingAs($user)->getJson('/ready')->assertNotFound();
        $this->actingAs($user)->get('/events/releases')->assertNotFound();
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('modules', fn ($modules) => ! collect($modules)->contains('games') && collect($modules)->contains('music'))
            ->where('plugins.ready_to_play', false)
            ->where('plugins.clip_of_week', false)
            ->where('plugins.game_backlog', false));
        $this->actingAs($user)->get('/events')->assertInertia(fn (Assert $page) => $page
            ->where('kinds', fn ($kinds) => ! collect($kinds)->has('game') && ! collect($kinds)->has('server'))
            ->where('releasesOn', false));

        // Той самий сайт у режимі «Усе включено» — усе на місці.
        $all = User::factory()->create();
        $this->actingAs($all)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('plugins.ready_to_play', true));
    }

    public function test_profile_blocks_badges_and_cards_follow_the_viewer_mode(): void
    {
        $user = $this->classic();
        $owner = User::factory()->create();
        $game = Game::query()->create(['slug' => 'apex', 'name' => 'Apex', 'letter' => 'A', 'category' => 'pc', 'is_published' => true]);

        $this->actingAs($user)->get('/'.$owner->username)->assertInertia(fn (Assert $page) => $page
            ->where('blockOrder', fn ($order) => ! collect($order)->intersect(['steam', 'games', 'platforms', 'characters'])->count() && collect($order)->contains('audio'))
            ->where('backlog', null)
            ->where('characters', []));

        $this->actingAs($user);
        $this->assertNull(app(PostCards::class)->resolve('game', $game->id));
        Cache::flush();
        $keys = collect(app(Achievements::class)->for($owner)['badges'])->pluck('key');
        $this->assertFalse($keys->contains('clan_founder'));
        $this->assertFalse($keys->contains('clip_of_week'));
        $this->assertTrue($keys->contains('musician'));
    }

    public function test_saving_block_order_keeps_blocks_hidden_by_mode_in_place(): void
    {
        $user = $this->classic();
        $user->mergePref(['profile_blocks' => ProfileBlocks::ORDER]);
        $user->save();
        $this->actingAs($user);

        $visible = ProfileBlocks::visible($user->pref('profile_blocks'));
        $this->assertNotContains('steam', $visible);
        $merged = ProfileBlocks::merge($user->pref('profile_blocks'), array_reverse($visible));
        // Приховані режимом блоки — на старих місцях, видимі — у новому порядку.
        $this->assertSame(array_search('steam', ProfileBlocks::ORDER, true), array_search('steam', $merged, true));
        $this->assertSame(array_search('characters', ProfileBlocks::ORDER, true), array_search('characters', $merged, true));
        $this->assertSame('photos', array_values(array_filter($merged, fn ($key) => in_array($key, $visible, true)))[0]);
    }

    public function test_background_notices_respect_the_recipient_mode(): void
    {
        $user = $this->classic();

        $this->assertFalse(NotifyPrefs::allowsKind($user, 'giveaway'));
        $this->assertFalse(NotifyPrefs::allowsKind($user, 'friend_playing'));
        $this->assertFalse(NotifyPrefs::allowsKind($user, 'tournament'));
        $this->assertFalse(NotifyPrefs::allowsKind($user, 'family_event'));
        $this->assertTrue(NotifyPrefs::allowsKind($user, 'post_like'));
        $this->assertTrue(NotifyPrefs::allowsKind(User::factory()->create(), 'giveaway'));

        // Ранковий дайджест без завдань дня (їх немає в «Класиці»).
        $this->assertSame([], array_filter(app(MorningDigest::class)->lines($user), fn (string $line) => str_starts_with($line, 'Завдань дня')));
    }
}
