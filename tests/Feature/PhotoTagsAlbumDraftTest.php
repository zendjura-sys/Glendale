<?php

namespace Tests\Feature;

use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\PhotoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PhotoTagsAlbumDraftTest extends TestCase
{
    use RefreshDatabase;

    public function test_friend_tags_shared_album_and_composer_keeps_a_draft(): void
    {
        Storage::fake('public');
        [$owner, $friend, $stranger] = User::factory()->count(3)->create();
        $friend->forceFill(['username' => 'marta'])->save();
        $friendships = app(FriendshipService::class);
        $friendships->request($owner, $friend);
        $friendships->accept($friend, $owner);

        $album = app(PhotoService::class)->createAlbum($owner, [
            'title' => 'Ніч',
            'privacy' => PhotoAlbum::PRIVACY_PRIVATE,
        ]);
        $photo = $album->photos()->create([
            'user_id' => $owner->id,
            'path' => 'photos/night.jpg',
            'width' => 8,
            'height' => 8,
        ]);

        $this->actingAs($friend)->get(route('albums.show', $album))->assertNotFound();
        $this->actingAs($owner)->post(route('albums.contributors.store', $album), [
            'username' => 'marta',
        ])->assertRedirect();
        $this->actingAs($owner)->post(route('albums.contributors.store', $album), [
            'username' => $stranger->username,
        ])->assertStatus(422);

        $this->withoutVite()->actingAs($friend)->get(route('albums.show', $album))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('can.upload', true)->where('contributors.0.username', 'marta'));
        $this->actingAs($stranger)->get(route('albums.show', $album))->assertNotFound();

        $this->actingAs($friend)->post(route('albums.upload', $album), [
            'photos' => [UploadedFile::fake()->image('a.jpg')],
        ])->assertRedirect();
        $this->assertSame(2, $album->fresh()->photos_count);
        $this->assertTrue(Photo::query()->where('user_id', $friend->id)->exists());

        $this->actingAs($owner)->postJson(route('photos.tags.store', $photo), [
            'username' => 'marta',
        ])->assertOk()->assertJsonPath('user.username', 'marta');
        $this->actingAs($owner)->postJson(route('photos.tags.store', $photo), [
            'username' => $stranger->username,
        ])->assertStatus(422);
        $this->assertTrue($friend->fresh()->notifications->contains(
            fn ($note) => ($note->data['kind'] ?? null) === 'photo_tag',
        ));
        $this->actingAs($friend)->getJson(route('photos.show', $photo))
            ->assertOk()
            ->assertJsonPath('photo.tags.0.username', 'marta');

        $this->actingAs($friend)->deleteJson(route('photos.tags.destroy', [$photo, $friend]))->assertOk();
        $this->assertSame(0, $photo->tags()->count());

        $composer = file_get_contents(resource_path('js/components/gc/post-composer.tsx'));
        $this->assertIsString($composer);
        $this->assertStringContainsString('gc-composer:', $composer);
        $this->assertStringContainsString('localStorage', $composer);
    }
}
