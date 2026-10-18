<?php

namespace Tests\Feature;

use App\Models\ImageFlag;
use App\Models\Photo;
use App\Models\User;
use App\Services\PhotoService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NsfwCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_explicit_photos_are_blurred_and_go_to_moderators(): void
    {
        $this->withoutVite();
        Storage::fake('public');
        $user = User::factory()->create();
        $album = app(PhotoService::class)->createAlbum($user, ['title' => 'Скрини', 'privacy' => 'all']);

        $scores = [0.2, 0.6, 0.93];
        Http::fake(['api.sightengine.com/*' => function () use (&$scores) {
            return Http::response(['status' => 'success', 'nudity' => ['sexual_activity' => array_shift($scores), 'sexual_display' => 0.01, 'erotica' => 0.01, 'very_suggestive' => 0.01]]);
        }]);

        // Без ключів — нічого не перевіряємо.
        app(PhotoService::class)->upload($album, $user, [UploadedFile::fake()->image('a.jpg')]);
        Http::assertNothingSent();

        app(SiteSettings::class)->put(['sightengine_user' => '123456']);
        app(SiteSettings::class)->putSecret('sightengine_secret', 'abcdefghijklmnop1234');
        [$clean, $suggestive, $explicit] = app(PhotoService::class)->upload($album, $user, [
            UploadedFile::fake()->image('b.jpg'), UploadedFile::fake()->image('c.jpg'), UploadedFile::fake()->image('d.jpg'),
        ]);
        $this->assertFalse($clean->fresh()->is_sensitive);
        $this->assertTrue($suggestive->fresh()->is_sensitive);
        $this->assertTrue($explicit->fresh()->is_sensitive);
        $flag = ImageFlag::query()->sole();
        $this->assertSame($explicit->id, $flag->subject_id);

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get(route('admin.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page->has('images', 1)->where('images.0.score', 0.93));
        $this->actingAs($admin)->post(route('admin.moderation.images.resolve', $flag), ['action' => 'remove'])->assertRedirect();
        $this->assertNull(Photo::query()->find($explicit->id));
        $this->assertSame(ImageFlag::REMOVED, $flag->fresh()->status);
    }
}
