<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Games\GameCatalog;
use App\Services\Games\PosterPalette;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PosterPaletteTest extends TestCase
{
    use RefreshDatabase;

    private function poster(int $r, int $g, int $b): string
    {
        $image = imagecreatetruecolor(80, 60);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 18, 18, 30));
        imagefilledrectangle($image, 10, 10, 60, 50, (int) imagecolorallocate($image, $r, $g, $b));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    public function test_swatches_follow_the_poster_colors(): void
    {
        $palette = app(PosterPalette::class)->fromImage($this->poster(230, 40, 30));

        $this->assertNotNull($palette);
        $this->assertArrayHasKey('vibrant', $palette['swatches']);
        [$r, $g, $b] = sscanf($palette['accent'], '#%02x%02x%02x');
        $this->assertGreaterThan($g + 60, $r, 'Акцент червоного постера — червоний');
        $this->assertGreaterThan($b + 60, $r);
        $this->assertNull(app(PosterPalette::class)->fromImage('не картинка'));
    }

    public function test_palette_is_computed_once_then_cached_and_a_new_poster_gets_new_colors(): void
    {
        Cache::flush();
        Http::fake([
            'posters.test/*' => Http::response($this->poster(30, 120, 240)),
            'covers.test/*' => Http::response($this->poster(230, 40, 30)),
        ]);
        $service = app(PosterPalette::class);

        $this->assertNull($service->cached('https://posters.test/a.png'), 'Ще не рахували');
        $blue = $service->resolve('https://posters.test/a.png');
        $this->assertNotNull($blue);
        $this->assertSame($blue, $service->cached('https://posters.test/a.png'));
        $service->resolve('https://posters.test/a.png');
        Http::assertSentCount(1);
        [$r, , $b] = sscanf($blue['accent'], '#%02x%02x%02x');
        $this->assertGreaterThan($r, $b);

        $red = $service->resolve('https://covers.test/b.png');
        $this->assertNotNull($red);
        $this->assertNotSame($blue['accent'], $red['accent']);

        $this->assertSame(
            'https://images.igdb.com/igdb/image/upload/t_screenshot_med/abc.jpg',
            PosterPalette::small('https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg'),
        );
    }

    public function test_game_page_loads_poster_colors_right_after_the_first_render(): void
    {
        Cache::flush();
        Http::fake(['*' => Http::response($this->poster(230, 40, 30))]);
        app(GameCatalog::class)->seed();
        $game = Game::query()->whereNotNull('cover')->firstOrFail();
        $user = User::factory()->create();

        $this->actingAs($user)->get('/games/'.$game->slug)
            ->assertInertia(fn (Assert $page) => $page
                ->missing('palette')
                ->loadDeferredProps('palette', fn (Assert $reload) => $reload->where('palette.accent', fn (string $hex) => str_starts_with($hex, '#'))));

        $this->actingAs($user)->get('/games/'.$game->slug)
            ->assertInertia(fn (Assert $page) => $page->has('palette.accent'));

        // Застосунок отримує кольори одразу в JSON.
        $token = app(ApiTokens::class)->issue($user);
        $this->withToken($token)->getJson('/api/v1/games/'.$game->slug)->assertOk()->assertJsonPath('palette.accent', fn ($hex) => is_string($hex) && str_starts_with($hex, '#'));
    }
}
