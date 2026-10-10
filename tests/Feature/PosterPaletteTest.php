<?php

namespace Tests\Feature;

use App\Services\Games\PosterPalette;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PosterPaletteTest extends TestCase
{
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

    public function test_palette_is_computed_once_after_the_response_and_then_cached(): void
    {
        Cache::flush();
        Http::fake(['posters.test/*' => Http::response($this->poster(30, 120, 240))]);
        $service = app(PosterPalette::class);

        $this->assertNull($service->for('https://posters.test/a.png'));
        $this->app->terminate();
        $cached = $service->for('https://posters.test/a.png');

        $this->assertNotNull($cached);
        Http::assertSentCount(1);

        // Новий постер — нова палітра.
        Http::fake(['covers.test/*' => Http::response($this->poster(230, 40, 30))]);
        $this->assertNull($service->for('https://covers.test/b.png'));
        $this->app->terminate();
        $red = $service->for('https://covers.test/b.png');
        $this->assertNotNull($red);
        $this->assertNotSame($cached['accent'], $red['accent']);
        [$r, , $b] = sscanf($cached['accent'], '#%02x%02x%02x');
        $this->assertGreaterThan($r, $b);
    }
}
