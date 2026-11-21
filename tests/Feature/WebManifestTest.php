<?php

namespace Tests\Feature;

use Tests\TestCase;

/** №230: маніфест і мета для «На початковий екран» — без них iPhone не дає веб-пуші. */
class WebManifestTest extends TestCase
{
    public function test_manifest_is_installable(): void
    {
        $manifest = json_decode((string) file_get_contents(public_path('site.webmanifest')), true);

        $this->assertSame('standalone', $manifest['display']);
        $this->assertSame('/', $manifest['id']);
        $sizes = array_column($manifest['icons'], 'sizes');
        $this->assertContains('192x192', $sizes);
        $this->assertContains('512x512', $sizes);
        foreach ($manifest['icons'] as $icon) {
            $this->assertFileExists(public_path(ltrim($icon['src'], '/')));
        }
    }

    public function test_layout_has_home_screen_meta(): void
    {
        $blade = (string) file_get_contents(resource_path('views/app.blade.php'));

        $this->assertStringContainsString('apple-mobile-web-app-capable', $blade);
        $this->assertStringContainsString('site.webmanifest', $blade);
    }
}
