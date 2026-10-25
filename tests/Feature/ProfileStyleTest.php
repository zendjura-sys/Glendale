<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Support\GameTheme;
use App\Support\PlusStyle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Тема профілю за грою, звук сповіщень, нові анімації ніку GameCon+. */
class ProfileStyleTest extends TestCase
{
    use RefreshDatabase;

    private const COVER = 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg';

    private function game(): Game
    {
        // Палітра вже порахована — без звернень до IGDB.
        Cache::put('poster.palette.'.md5(self::COVER), [
            'base' => '#101820', 'accent' => '#ff5500', 'soft' => '#ffd0b0',
            'swatches' => ['vibrant' => '#ff5500', 'light_vibrant' => '#ffaa66', 'dark_vibrant' => '#802000'],
        ], now()->addDay());

        return Game::query()->create(['slug' => 'apex', 'name' => 'Apex', 'letter' => 'A', 'category' => 'pc', 'is_published' => true, 'cover' => self::COVER]);
    }

    public function test_profile_takes_colors_from_favorite_game(): void
    {
        Http::preventStrayRequests();
        $game = $this->game();
        $user = User::factory()->create();

        $this->actingAs($user)->put('/settings/game-theme', ['game_id' => $game->id])->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame($game->id, $user->refresh()->pref(GameTheme::PREF));
        $this->assertSame(['#ff5500', '#ffaa66', '#802000'], GameTheme::colors($user));

        $this->actingAs(User::factory()->create())->get('/'.$user->username)
            ->assertInertia(fn ($page) => $page->where('profile.accent', ['#ff5500', '#ffaa66', '#802000']));
        $this->actingAs($user)->get('/settings/appearance')
            ->assertInertia(fn ($page) => $page->where('gameTheme.game.id', $game->id));

        $this->actingAs($user)->put('/settings/game-theme', ['game_id' => null])->assertRedirect();
        $this->assertNull(GameTheme::colors($user->refresh()));
        $this->actingAs($user)->put('/settings/game-theme', ['game_id' => 999999])->assertSessionHasErrors('game_id');
    }

    public function test_notify_sound_is_saved_and_shared(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn ($page) => $page->where('auth.user.notify_sound', 'soft'));

        $this->actingAs($user)->patch('/settings/notify-sound', ['notify_sound' => 'arcade'])->assertRedirect();
        $this->actingAs($user)->get('/feed')->assertInertia(fn ($page) => $page->where('auth.user.notify_sound', 'arcade'));
        $this->actingAs($user)->patch('/settings/notify-sound', ['notify_sound' => 'loud'])->assertSessionHasErrors('notify_sound');
    }

    public function test_new_nick_effects_are_allowed(): void
    {
        $this->assertSame('neon', PlusStyle::clean(['fx' => 'neon'])['fx']);
        $this->assertSame('rainbow', PlusStyle::card(['fx' => 'rainbow'])['fx']);
        $this->assertArrayNotHasKey('fx', PlusStyle::clean(['fx' => 'blink']));
    }
}
