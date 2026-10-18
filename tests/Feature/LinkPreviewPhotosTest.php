<?php

namespace Tests\Feature;

use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\Post;
use App\Models\User;
use App\Services\PhotoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LinkPreviewPhotosTest extends TestCase
{
    use RefreshDatabase;

    public function test_link_preview_sensitive_photo_and_alt(): void
    {
        Http::fake([
            'https://example.com/news' => Http::response(
                '<html><head><meta property="og:title" content="Нічний рейд"><meta property="og:image" content="https://example.com/cover.jpg"></head></html>',
                200,
                ['Content-Type' => 'text/html; charset=utf-8'],
            ),
            'https://example.com/file.png' => Http::response('png', 200, ['Content-Type' => 'image/png']),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Дивіться https://example.com/news',
            'visibility' => 'public',
        ])->assertRedirect();

        $post = Post::query()->sole();
        $this->assertSame('Нічний рейд', $post->link['title']);
        $this->assertSame('https://example.com/cover.jpg', $post->link['thumbnail']);
        $this->assertSame('example.com', $post->link['site']);
        Storage::disk('public')->assertMissing('cover.jpg');

        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Файл https://example.com/file.png',
            'visibility' => 'public',
        ])->assertRedirect();
        $filePost = Post::query()->where('body', 'Файл https://example.com/file.png')->sole();
        $this->assertSame('example.com', $filePost->link['title']);
        $this->assertNull($filePost->link['thumbnail']);

        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Секрет http://127.0.0.1/admin',
            'visibility' => 'public',
        ])->assertRedirect();
        $this->assertNull(Post::query()->where('body', 'Секрет http://127.0.0.1/admin')->sole()->link);

        Storage::fake('public');
        $album = app(PhotoService::class)->createAlbum($user, [
            'title' => 'Ніч',
            'privacy' => PhotoAlbum::PRIVACY_PUBLIC,
        ]);
        $photo = $album->photos()->create([
            'user_id' => $user->id,
            'path' => 'photos/night.jpg',
            'width' => 10,
            'height' => 10,
        ]);
        $album->recount();

        $this->actingAs($user)->patchJson(route('photos.update', $photo), [
            'alt' => 'Нічне місто з вікна',
            'is_sensitive' => true,
        ])->assertOk()
            ->assertJsonPath('alt', 'Нічне місто з вікна')
            ->assertJsonPath('is_sensitive', true);

        $this->assertTrue($photo->fresh()->is_sensitive);
        $this->assertSame('Нічне місто з вікна', $photo->fresh()->alt);

        $this->withoutVite()->actingAs($user)->get(route('albums.show', $album))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('photos.data.0.alt', 'Нічне місто з вікна')
                ->where('photos.data.0.is_sensitive', true));

        $this->withoutVite()->actingAs($user)->get(route('profile.show', $user))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('photos.0.alt', 'Нічне місто з вікна')
                ->where('photos.0.is_sensitive', true));

        $stranger = User::factory()->create();
        $this->actingAs($stranger)->patchJson(route('photos.update', $photo), [
            'alt' => 'Чуже',
        ])->assertForbidden();
        $this->assertSame('Нічне місто з вікна', Photo::query()->find($photo->id)->alt);
    }
}
